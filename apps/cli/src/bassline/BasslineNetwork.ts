/**
 * Bassline Network Runtime
 * 
 * Core implementation of a Bassline-aware propagation network node.
 * Manages topology, content, and peer relationships based on Bassline truth.
 */

import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { createHash } from 'crypto'
import { NetworkRuntime } from '../runtime/NetworkRuntime.js'
import { StorageBackedRuntime } from '../runtime/StorageBackedRuntime.js'
import type { NetworkStorage, NetworkState } from '@bassline/core'
import type {
  Bassline,
  BasslineNode,
  BasslinePeer,
  BasslineCommand,
  BasslineEvent,
  BasslineConfig,
  Endpoint,
  GroupSpec,
  ContactSpec,
  WireSpec,
  BasslineReference
} from './types.js'

export class BasslineNetwork extends EventEmitter {
  private config: BasslineConfig
  private bassline?: Bassline
  private runtime: NetworkRuntime
  private storage?: NetworkStorage
  
  // Network state
  private localGroups = new Set<string>()
  private localContent = new Map<string, any>()
  private ownership = new Map<string, Set<string>>()
  private peers = new Map<string, BasslinePeer>()
  
  // Sub-networks for groups that are themselves Basslines
  private subNetworks = new Map<string, BasslineNetwork>()
  
  // Network quality tracking
  private brokenWires = new Set<string>()
  private wireHealth = new Map<string, number>()  // Wire health scores
  
  constructor(config: BasslineConfig) {
    super()
    this.config = {
      syncInterval: 30000,
      heartbeatInterval: 10000,
      partitionCheckInterval: 5000,
      maxPeers: 50,
      maxSubNetworks: 10,
      maxContentSize: 1024 * 1024, // 1MB
      ...config
    }
    
    // Create runtime - will be replaced with proper StorageBackedRuntime in joinNetwork if needed
    this.runtime = new NetworkRuntime()
    
    this.storage = config.storage
  }
  
  /**
   * Load and validate a Bassline
   */
  async loadBassline(source: string | Bassline): Promise<Bassline> {
    let bassline: Bassline
    
    if (typeof source === 'string') {
      // Load from URL/file/IPFS
      bassline = await this.fetchBassline(source)
    } else {
      bassline = source
    }
    
    // Validate structure
    if (!this.validateBassline(bassline)) {
      throw new Error('Invalid Bassline structure')
    }
    
    // Verify signature if present
    if (bassline.metadata.signature && !this.verifySignature(bassline)) {
      throw new Error('Bassline signature verification failed')
    }
    
    return bassline
  }
  
  /**
   * Join a Bassline network
   */
  async joinNetwork(bassline: Bassline, groupsToRun?: string[]): Promise<void> {
    this.bassline = bassline
    
    // Replace runtime with StorageBackedRuntime if storage is provided
    if (this.storage) {
      console.log(`[BasslineNetwork] Creating StorageBackedRuntime for network ${bassline.id}`)
      this.runtime = new StorageBackedRuntime({
        storage: this.storage,
        networkId: bassline.id,
        loadOnInit: false // Don't load on init, let topology get set up first
      })
    }
    
    // Determine which groups to run
    if (groupsToRun) {
      groupsToRun.forEach(g => this.localGroups.add(g))
    } else if (this.config.autoSelectGroups) {
      this.autoSelectGroups()
    }
    
    // Load topology into runtime
    await this.loadTopology()
    
    // Initialize network in storage if using StorageBackedRuntime
    if (this.storage && this.runtime instanceof StorageBackedRuntime) {
      console.log(`[BasslineNetwork] Saving initial network state to storage`)
      try {
        const exportedState = this.runtime.exportState()
        
        // Convert plain objects to Maps for storage compatibility
        const networkState = {
          networkId: bassline.id,
          groups: new Map(Object.entries(exportedState.groups || {})),
          wires: new Map(Object.entries(exportedState.wires || {})),
          currentGroupId: 'root',
          rootGroupId: 'root'
        }
        
        await this.storage.saveNetworkState(bassline.id as any, networkState as any)
        console.log(`[BasslineNetwork] Network state saved successfully`)
      } catch (error) {
        console.error(`[BasslineNetwork] Failed to save network state:`, error)
      }
    }
    
    // Connect to endpoints for remote groups
    await this.connectToEndpoints()
    
    // Start running local groups
    await this.startLocalGroups()
    
    // Begin synchronization
    this.startSync()
    
    this.emit('bassline.loaded', { bassline })
  }
  
  /**
   * Load Bassline topology into runtime
   */
  private async loadTopology(): Promise<void> {
    if (!this.bassline) return
    
    // Register all groups
    for (const [groupId, groupSpec] of this.bassline.topology.groups) {
      this.runtime.registerGroup({
        id: groupId,
        name: groupSpec.name,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [...groupSpec.inputs, ...groupSpec.outputs]
      })
    }
    
    // Add all contacts
    for (const [contactId, contactSpec] of this.bassline.topology.contacts) {
      this.runtime.addContact(contactSpec.groupId, {
        id: contactId,
        content: null,
        blendMode: contactSpec.blendMode,
        name: contactSpec.name,
        isBoundary: contactSpec.isBoundary,
        boundaryDirection: contactSpec.boundaryDirection
      })
    }
    
    // Connect all wires
    for (const [wireId, wireSpec] of this.bassline.topology.wires) {
      this.runtime.connect(wireSpec.fromId, wireSpec.toId, wireSpec.type)
    }
  }
  
  /**
   * Connect to remote endpoints
   */
  private async connectToEndpoints(): Promise<void> {
    if (!this.bassline) return
    
    for (const [groupId, endpoint] of this.bassline.endpoints) {
      // Skip if we're running this group locally
      if (this.localGroups.has(groupId)) continue
      
      try {
        await this.connectToPeer(endpoint)
      } catch (error) {
        console.error(`Failed to connect to ${endpoint.url}:`, error)
      }
    }
  }
  
  /**
   * Connect to a peer endpoint
   */
  async connectToPeer(endpoint: Endpoint): Promise<void> {
    const ws = new WebSocket(endpoint.url)
    
    const peer: BasslinePeer = {
      id: endpoint.peerId,
      endpoint,
      connection: ws,
      ownedGroups: new Set(),
      ownedContacts: new Set(),
      latency: 0,
      lastSeen: Date.now(),
      reliability: 1.0,
      wireAffinity: 0
    }
    
    ws.on('open', () => {
      console.log(`Connected to peer ${endpoint.peerId} at ${endpoint.url}`)
      this.peers.set(endpoint.peerId, peer)
      
      // Exchange Bassline hashes
      this.sendCommand(peer, {
        type: 'bassline-hash',
        hash: this.hashBassline(this.bassline!),
        version: this.bassline!.version
      })
      
      // Announce our ownership
      this.announceOwnership(peer)
      
      this.emit('peer.connected', { peer })
    })
    
    ws.on('message', (data) => {
      this.handleCommand(peer, JSON.parse(data.toString()))
    })
    
    ws.on('close', () => {
      console.log(`Disconnected from peer ${endpoint.peerId}`)
      this.peers.delete(endpoint.peerId)
      this.emit('peer.disconnected', { peerId: endpoint.peerId })
      
      // Check for broken wires
      this.checkBrokenWires()
    })
    
    ws.on('error', (error) => {
      console.error(`Peer error ${endpoint.peerId}:`, error)
    })
  }
  
  /**
   * Handle incoming command from peer
   */
  private async handleCommand(peer: BasslinePeer, cmd: BasslineCommand): Promise<void> {
    peer.lastSeen = Date.now()
    
    switch (cmd.type) {
      case 'bassline-hash':
        // Verify we're on the same Bassline
        const ourHash = this.hashBassline(this.bassline!)
        if (cmd.hash !== ourHash) {
          console.warn(`Bassline mismatch with ${peer.id}`)
          // Could negotiate or reject
        }
        break
        
      case 'group-ownership':
        // Update peer's ownership info
        cmd.groups.forEach(g => peer.ownedGroups.add(g))
        cmd.contacts.forEach(c => {
          peer.ownedContacts.add(c)
          // Track global ownership
          if (!this.ownership.has(c)) {
            this.ownership.set(c, new Set())
          }
          this.ownership.get(c)!.add(peer.id)
        })
        
        // Calculate wire affinity
        this.calculateWireAffinity(peer)
        break
        
      case 'content-update':
        // Validate and apply update
        if (this.validateContent(cmd.contactId, cmd.content)) {
          this.runtime.scheduleUpdate(cmd.contactId, cmd.content)
          this.localContent.set(cmd.contactId, cmd.content)
          this.emit('content.updated', { contactId: cmd.contactId, content: cmd.content })
        }
        break
        
      case 'wire-sync':
        // Handle wire-based synchronization
        await this.handleWireSync(peer, cmd)
        break
        
      case 'partition-detected':
        // Peer detected broken wires
        cmd.brokenWires.forEach(w => this.brokenWires.add(w))
        this.checkPartitionHealing(peer)
        break
        
      case 'sync-request':
        // Send requested contacts
        const updates: Record<string, any> = {}
        for (const contactId of cmd.contacts) {
          if (this.localContent.has(contactId)) {
            updates[contactId] = this.localContent.get(contactId)
          }
        }
        this.sendCommand(peer, {
          type: 'sync-response',
          updates
        })
        break
        
      case 'sync-response':
        // Apply received updates
        for (const [contactId, content] of Object.entries(cmd.updates)) {
          if (this.validateContent(contactId, content)) {
            this.runtime.scheduleUpdate(contactId, content)
            this.localContent.set(contactId, content)
          }
        }
        break
    }
  }
  
  /**
   * Calculate wire affinity with a peer
   */
  private calculateWireAffinity(peer: BasslinePeer): void {
    if (!this.bassline) return
    
    let affinity = 0
    
    // Check how many wires connect our contacts to theirs
    for (const [wireId, wire] of this.bassline.topology.wires) {
      const weHaveFrom = this.localGroups.has(
        this.getGroupForContact(wire.fromId)
      )
      const weHaveTo = this.localGroups.has(
        this.getGroupForContact(wire.toId)
      )
      const theyHaveFrom = peer.ownedContacts.has(wire.fromId)
      const theyHaveTo = peer.ownedContacts.has(wire.toId)
      
      // We're connected via this wire
      if ((weHaveFrom && theyHaveTo) || (weHaveTo && theyHaveFrom)) {
        affinity += wire.priority || 1
      }
    }
    
    peer.wireAffinity = affinity
  }
  
  /**
   * Check for partition healing opportunity
   */
  private checkPartitionHealing(bridgePeer: BasslinePeer): void {
    const healed = new Set<string>()
    
    for (const wireId of this.brokenWires) {
      const wire = this.bassline?.topology.wires.get(wireId)
      if (!wire) continue
      
      // Check if this peer can heal the wire
      const fromOwners = this.ownership.get(wire.fromId) || new Set()
      const toOwners = this.ownership.get(wire.toId) || new Set()
      
      // If we can reach both sides through our peers, we can heal
      let canReachFrom = false
      let canReachTo = false
      
      for (const peer of this.peers.values()) {
        if (fromOwners.has(peer.id)) canReachFrom = true
        if (toOwners.has(peer.id)) canReachTo = true
      }
      
      if (canReachFrom && canReachTo) {
        healed.add(wireId)
        console.log(`PARTITION HEALED: Wire ${wireId} bridged by ${this.config.peerId}`)
      }
    }
    
    if (healed.size > 0) {
      // Remove healed wires from broken list
      healed.forEach(w => this.brokenWires.delete(w))
      
      // Announce healing
      this.broadcast({
        type: 'partition-healed',
        healedWires: Array.from(healed)
      })
      
      // Trigger aggressive sync to reconcile partitions
      this.aggressiveSync()
      
      this.emit('partition.healed', { bridgeNode: this.config.peerId })
    }
  }
  
  /**
   * Aggressive sync when partition is healed
   */
  private async aggressiveSync(): Promise<void> {
    console.log('Starting aggressive sync to heal partition...')
    
    // Request all contacts we don't have from all peers
    const missingContacts = new Set<string>()
    
    for (const [contactId] of this.bassline!.topology.contacts) {
      if (!this.localContent.has(contactId)) {
        missingContacts.add(contactId)
      }
    }
    
    // Request from all peers
    for (const peer of this.peers.values()) {
      this.sendCommand(peer, {
        type: 'sync-request',
        contacts: Array.from(missingContacts)
      })
    }
  }
  
  /**
   * Start running local groups
   */
  private async startLocalGroups(): Promise<void> {
    for (const groupId of this.localGroups) {
      const groupSpec = this.bassline?.topology.groups.get(groupId)
      if (!groupSpec) continue
      
      if (groupSpec.bassline) {
        // This group is a sub-Bassline
        await this.startSubBassline(groupId, groupSpec.bassline)
      } else if (groupSpec.primitive) {
        // This is a primitive gadget
        console.log(`Running primitive gadget: ${groupId}`)
        // Primitive execution handled by runtime
      } else {
        // Regular group
        console.log(`Running group: ${groupId}`)
      }
    }
  }
  
  /**
   * Start a sub-Bassline network
   */
  private async startSubBassline(groupId: string, ref: BasslineReference): Promise<void> {
    console.log(`Starting sub-Bassline for group ${groupId}`)
    
    const subNetwork = new BasslineNetwork({
      ...this.config,
      peerId: `${this.config.peerId}/${groupId}`
    })
    
    const subBassline = await subNetwork.loadBassline(ref.url)
    await subNetwork.joinNetwork(subBassline)
    
    this.subNetworks.set(groupId, subNetwork)
    
    // Bridge boundaries between parent and sub
    this.bridgeSubBassline(groupId, subNetwork)
    
    this.emit('sub-bassline.started', { groupId })
  }
  
  /**
   * Bridge boundaries between parent and sub-Bassline
   */
  private bridgeSubBassline(groupId: string, subNetwork: BasslineNetwork): void {
    const groupSpec = this.bassline?.topology.groups.get(groupId)
    if (!groupSpec) return
    
    // Wire inputs from parent to sub
    for (const inputId of groupSpec.inputs) {
      // Listen for changes in parent
      this.runtime.on(`contact.updated.${inputId}`, (content) => {
        // Forward to sub-network
        subNetwork.updateContact(inputId, content)
      })
    }
    
    // Wire outputs from sub to parent
    for (const outputId of groupSpec.outputs) {
      // Listen for changes in sub
      subNetwork.on(`content.updated`, ({ contactId, content }) => {
        if (contactId === outputId) {
          // Forward to parent
          this.runtime.scheduleUpdate(outputId, content)
        }
      })
    }
  }
  
  // Helper methods
  
  private hashBassline(bassline: Bassline): string {
    const str = JSON.stringify({
      id: bassline.id,
      version: bassline.version,
      topology: {
        groups: Array.from(bassline.topology.groups.entries()).sort((a, b) => a[0].localeCompare(b[0])),
        contacts: Array.from(bassline.topology.contacts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
        wires: Array.from(bassline.topology.wires.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      }
    })
    return createHash('sha256').update(str).digest('hex')
  }
  
  private validateBassline(bassline: Bassline): boolean {
    // Check required fields
    if (!bassline.id || !bassline.version || !bassline.topology) {
      return false
    }
    
    // Validate topology consistency
    // TODO: Check that all wire endpoints exist, etc.
    
    return true
  }
  
  private verifySignature(bassline: Bassline): boolean {
    // TODO: Implement signature verification
    return true
  }
  
  private validateContent(contactId: string, content: any): boolean {
    // TODO: Validate against contact schema if defined
    return true
  }
  
  private getGroupForContact(contactId: string): string {
    const contact = this.bassline?.topology.contacts.get(contactId)
    return contact?.groupId || ''
  }
  
  private announceOwnership(peer: BasslinePeer): void {
    const ownedContacts: string[] = []
    
    // Find contacts we own
    for (const [contactId, contact] of this.bassline!.topology.contacts) {
      if (this.localGroups.has(contact.groupId)) {
        ownedContacts.push(contactId)
      }
    }
    
    this.sendCommand(peer, {
      type: 'group-ownership',
      groups: Array.from(this.localGroups),
      contacts: ownedContacts
    })
  }
  
  private sendCommand(peer: BasslinePeer, cmd: BasslineCommand): void {
    if (peer.connection?.readyState === WebSocket.OPEN) {
      peer.connection.send(JSON.stringify(cmd))
    }
  }
  
  private broadcast(cmd: BasslineCommand): void {
    for (const peer of this.peers.values()) {
      this.sendCommand(peer, cmd)
    }
  }
  
  private checkBrokenWires(): void {
    // TODO: Check which wires are broken due to missing peers
  }
  
  private autoSelectGroups(): void {
    // TODO: Automatically select underserved groups to run
  }
  
  private async fetchBassline(url: string): Promise<Bassline> {
    // TODO: Fetch from URL/IPFS/etc
    throw new Error('Not implemented')
  }
  
  private async handleWireSync(peer: BasslinePeer, cmd: any): Promise<void> {
    // TODO: Handle wire-based synchronization
  }
  
  private startSync(): void {
    // TODO: Start periodic synchronization
  }
  
  /**
   * Update a contact's content
   */
  async updateContact(contactId: string, content: any): Promise<void> {
    const oldContent = this.localContent.get(contactId)
    
    // Only update if content actually changed
    if (JSON.stringify(oldContent) === JSON.stringify(content)) return
    
    // StorageBackedRuntime.scheduleUpdate() will handle both local updates and storage persistence
    console.log(`[BasslineNetwork] Updating contact ${contactId} with content:`, JSON.stringify(content).substring(0, 100))
    
    // Check if contact exists in runtime
    const runtimeContact = (this.runtime as any).contacts?.get(contactId)
    console.log(`[BasslineNetwork] Runtime contact exists: ${!!runtimeContact}`)
    
    this.runtime.scheduleUpdate(contactId, content)
    this.localContent.set(contactId, content)
    
    // Emit change event for gossip layer
    this.emit('contact.updated', { contactId, content, oldContent })
  }
  
  /**
   * Get current convergence percentage
   */
  getConvergence(): number {
    if (!this.bassline) return 0
    
    const totalContacts = this.bassline.topology.contacts.size
    const hasContent = this.localContent.size
    
    return (hasContent / totalContacts) * 100
  }
  
  /**
   * Wait for all pending storage operations to complete
   */
  async waitForPendingOperations(): Promise<void> {
    if (this.runtime && 'waitForPendingOperations' in this.runtime) {
      await (this.runtime as any).waitForPendingOperations()
    }
  }
  
  /**
   * Shutdown the network
   */
  async shutdown(): Promise<void> {
    // Close peer connections
    for (const peer of this.peers.values()) {
      peer.connection?.close()
    }
    
    // Shutdown sub-networks
    for (const subNetwork of this.subNetworks.values()) {
      await subNetwork.shutdown()
    }
    
    this.removeAllListeners()
  }
}