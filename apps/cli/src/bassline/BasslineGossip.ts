/**
 * Bassline Gossip Protocol
 * 
 * Parallel, change-driven propagation following natural Bassline topology.
 * Only syncs when content changes, using wire relationships for routing.
 */

import { EventEmitter } from 'events'
import { WebSocketServer, WebSocket } from 'ws'
import { createHash } from 'crypto'
import { BasslineNetwork } from './BasslineNetwork.js'
import type {
  Bassline,
  BasslinePeer,
  BasslineCommand,
  Endpoint,
  WireSpec,
  ContactSpec
} from './types.js'

interface GossipConfig {
  port: number
  peerId: string
  bassline: Bassline
  network: BasslineNetwork
  heartbeatInterval?: number
}

export class BasslineGossip extends EventEmitter {
  private config: GossipConfig
  private server?: WebSocketServer
  private peers = new Map<string, BasslinePeer>()
  
  // Change-driven sync tracking
  private peerSubscriptions = new Map<string, Set<string>>() // peer -> contacts they want
  private contactHashes = new Map<string, string>() // track content changes
  private wireConnections = new Map<string, Set<string>>() // wire -> interested peers
  
  // Health tracking (keep for connection management)
  private brokenWires = new Set<string>()
  private wireHealth = new Map<string, WireHealthInfo>()
  
  constructor(config: GossipConfig) {
    super()
    this.config = {
      heartbeatInterval: 30000, // Longer heartbeat, less frequent
      ...config
    }
    
    // Initialize wire-to-peer mappings
    this.initializeWireConnections()
  }
  
  /**
   * Start the gossip server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Start WebSocket server
      this.server = new WebSocketServer({ port: this.config.port })
      
      this.server.on('connection', (ws, req) => {
        const peerId = req.headers['x-peer-id'] as string || 'unknown'
        this.handleIncomingPeer(ws, peerId)
      })
      
      this.server.on('listening', () => {
        console.log(`[BasslineGossip] Server listening on port ${this.config.port}`)
        
        // Only start heartbeat - no periodic sync needed
        this.startHeartbeat()
        
        // Listen for contact changes from the network
        this.config.network.on('contact.updated', (event) => {
          this.onContactUpdated(event.contactId, event.content)
        })
        
        resolve()
      })
      
      this.server.on('error', (err) => {
        console.error(`[BasslineGossip] Server error on port ${this.config.port}:`, err)
        reject(err)
      })
    })
  }
  
  /**
   * Connect to a peer
   */
  async connectToPeer(endpoint: Endpoint): Promise<void> {
    const ws = new WebSocket(endpoint.url, {
      headers: {
        'x-peer-id': this.config.peerId
      }
    })
    
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
      console.log(`[BasslineGossip] Connected to ${endpoint.peerId}`)
      this.peers.set(endpoint.peerId, peer)
      this.onPeerConnected(peer)
    })
    
    ws.on('message', (data) => {
      this.handleMessage(peer, JSON.parse(data.toString()))
    })
    
    ws.on('close', () => {
      console.log(`[BasslineGossip] Disconnected from ${endpoint.peerId}`)
      this.peers.delete(endpoint.peerId)
      this.onPeerDisconnected(peer)
    })
  }
  
  /**
   * Handle incoming peer connection
   */
  private handleIncomingPeer(ws: WebSocket, peerId: string): void {
    const peer: BasslinePeer = {
      id: peerId,
      endpoint: { url: '', peerId },
      connection: ws,
      ownedGroups: new Set(),
      ownedContacts: new Set(),
      latency: 0,
      lastSeen: Date.now(),
      reliability: 1.0,
      wireAffinity: 0
    }
    
    this.peers.set(peerId, peer)
    
    ws.on('message', (data) => {
      this.handleMessage(peer, JSON.parse(data.toString()))
    })
    
    ws.on('close', () => {
      this.peers.delete(peerId)
      this.onPeerDisconnected(peer)
    })
    
    this.onPeerConnected(peer)
  }
  
  /**
   * Called when a peer connects
   */
  private async onPeerConnected(peer: BasslinePeer): Promise<void> {
    // 1. Exchange Bassline hashes
    await this.exchangeBasslineHash(peer)
    
    // 2. Share ownership information
    await this.shareOwnership(peer)
    
    // Note: Subscriptions and initial state will be set up when we receive their ownership
    
    this.emit('peer.connected', peer)
  }
  
  /**
   * Called when a peer disconnects
   */
  private onPeerDisconnected(peer: BasslinePeer): void {
    // Update wire health
    this.updateWireHealthOnDisconnect(peer)
    
    // Check for new broken wires
    this.detectBrokenWires()
    
    this.emit('peer.disconnected', peer.id)
  }
  
  /**
   * Exchange Bassline hashes to ensure same network
   */
  private async exchangeBasslineHash(peer: BasslinePeer): Promise<void> {
    const ourHash = this.hashBassline(this.config.bassline)
    
    this.sendToPeer(peer, {
      type: 'bassline-hash',
      hash: ourHash,
      version: this.config.bassline.version
    })
  }
  
  /**
   * Share what we own with the peer
   */
  private async shareOwnership(peer: BasslinePeer): Promise<void> {
    const ownedGroups: string[] = []
    const ownedContacts: string[] = []
    
    // Get our ownership from the network
    const localGroups = this.config.network['localGroups'] as Set<string>
    
    for (const groupId of localGroups) {
      ownedGroups.push(groupId)
      
      // Find contacts in this group
      for (const [contactId, contact] of this.config.bassline.topology.contacts) {
        if (contact.groupId === groupId) {
          ownedContacts.push(contactId)
        }
      }
    }
    
    console.log(`[BasslineGossip] Sharing ownership with ${peer.id}: ${ownedGroups.length} groups, ${ownedContacts.length} contacts`)
    
    this.sendToPeer(peer, {
      type: 'group-ownership',
      groups: ownedGroups,
      contacts: ownedContacts
    })
  }
  
  /**
   * Check if this peer helps heal partitions
   */
  private checkPartitionHealing(peer: BasslinePeer): void {
    const healedWires: string[] = []
    
    for (const wireId of this.brokenWires) {
      const wire = this.config.bassline.topology.wires.get(wireId)
      if (!wire) continue
      
      // Check if peer has one end of the broken wire
      if (peer.ownedContacts.has(wire.fromId) || peer.ownedContacts.has(wire.toId)) {
        // Check if we can now reach both ends
        if (this.canReachBothEnds(wire)) {
          healedWires.push(wireId)
          this.brokenWires.delete(wireId)
        }
      }
    }
    
    if (healedWires.length > 0) {
      console.log(`[BasslineGossip] Healed ${healedWires.length} broken wires via ${peer.id}`)
      
      // Notify network of healing
      this.broadcast({
        type: 'partition-healed',
        healedWires
      })
      
      // Trigger aggressive sync
      this.triggerAggressiveSync(healedWires)
    }
  }
  
  /**
   * Set up wire-based subscriptions for a peer
   */
  private setupWireSubscriptions(peer: BasslinePeer): void {
    const subscriptions = new Set<string>()
    
    // Get the groups we own vs the groups they own
    const ourGroups = this.config.network['localGroups'] as Set<string>
    const theirGroups = peer.ownedGroups
    
    // Find contacts this peer should receive based on wire topology
    for (const [wireId, wire] of this.config.bassline.topology.wires) {
      const fromContact = this.config.bassline.topology.contacts.get(wire.fromId)
      const toContact = this.config.bassline.topology.contacts.get(wire.toId)
      
      if (!fromContact || !toContact) continue
      
      const weOwnFrom = ourGroups.has(fromContact.groupId)
      const weOwnTo = ourGroups.has(toContact.groupId)
      const theyOwnFrom = theirGroups.has(fromContact.groupId)
      const theyOwnTo = theirGroups.has(toContact.groupId)
      
      // If we own the source and they own the destination, they need updates from us
      if (weOwnFrom && theyOwnTo) {
        subscriptions.add(wire.fromId)
      }
      // If we own the destination and they own the source, we might send them updates
      if (weOwnTo && theyOwnFrom) {
        subscriptions.add(wire.toId)
      }
    }
    
    this.peerSubscriptions.set(peer.id, subscriptions)
    console.log(`[BasslineGossip] Peer ${peer.id} subscribed to ${subscriptions.size} contacts based on group ownership`)
  }
  
  /**
   * Send initial state for contacts a peer needs (one-time on connection)
   */
  private async sendInitialState(peer: BasslinePeer): Promise<void> {
    const subscriptions = this.peerSubscriptions.get(peer.id)
    if (!subscriptions) return
    
    const initialUpdates: any[] = []
    
    for (const contactId of subscriptions) {
      const content = await this.getContent(contactId)
      if (content !== null) {
        const hash = this.hashContent(content)
        this.contactHashes.set(contactId, hash)
        
        initialUpdates.push({
          contactId,
          content,
          hash
        })
      }
    }
    
    if (initialUpdates.length > 0) {
      this.sendToPeer(peer, {
        type: 'initial-state',
        updates: initialUpdates
      })
      console.log(`[BasslineGossip] Sent initial state: ${initialUpdates.length} contacts to ${peer.id}`)
    }
  }
  
  /**
   * Handle contact update from local network - this is the main sync trigger
   */
  private async onContactUpdated(contactId: string, content: any): Promise<void> {
    const newHash = this.hashContent(content)
    const oldHash = this.contactHashes.get(contactId)
    
    // Only propagate if content actually changed
    if (newHash === oldHash) return
    
    this.contactHashes.set(contactId, newHash)
    
    // Find all peers who are subscribed to this contact
    const interestedPeers: BasslinePeer[] = []
    
    for (const [peerId, subscriptions] of this.peerSubscriptions) {
      if (subscriptions.has(contactId)) {
        const peer = this.peers.get(peerId)
        if (peer) interestedPeers.push(peer)
      }
    }
    
    // Send update to all interested peers in parallel
    await Promise.all(interestedPeers.map(peer => 
      this.sendContactUpdate(peer, contactId, content, newHash)
    ))
    
    if (interestedPeers.length > 0) {
      console.log(`[BasslineGossip] Propagated ${contactId} to ${interestedPeers.length} peers`)
    }
  }
  
  /**
   * Send a contact update to a specific peer
   */
  private async sendContactUpdate(peer: BasslinePeer, contactId: string, content: any, hash: string): Promise<void> {
    this.sendToPeer(peer, {
      type: 'content-update',
      contactId,
      content,
      hash
    })
  }
  
  /**
   * Initialize wire-to-peer connection mappings
   */
  private initializeWireConnections(): void {
    // This will be populated as peers connect and we learn their ownership
    console.log(`[BasslineGossip] Initialized wire connections for ${this.config.bassline.topology.wires.size} wires`)
  }
  
  /**
   * Update wire health after sync
   */
  private updateWireHealth(wireId: string, success: boolean): void {
    const health = this.wireHealth.get(wireId)
    if (!health) return
    
    if (success) {
      health.health = Math.min(1.0, health.health + 0.1)
      health.lastSuccessfulSync = Date.now()
      health.failureCount = 0
    } else {
      health.health = Math.max(0, health.health - 0.2)
      health.failureCount++
    }
    
    // Mark as broken if health too low
    if (health.health < 0.3) {
      this.brokenWires.add(wireId)
      console.log(`[BasslineGossip] Wire ${wireId} marked as broken`)
    }
  }
  
  /**
   * Detect broken wires
   */
  private detectBrokenWires(): void {
    for (const [wireId, wire] of this.config.bassline.topology.wires) {
      if (!this.canReachBothEnds(wire)) {
        this.brokenWires.add(wireId)
        this.updateWireHealth(wireId, false)
      }
    }
    
    if (this.brokenWires.size > 0) {
      this.broadcast({
        type: 'partition-detected',
        brokenWires: Array.from(this.brokenWires)
      })
    }
  }
  
  /**
   * Check if we can reach both ends of a wire
   */
  private canReachBothEnds(wire: WireSpec): boolean {
    const fromReachable = this.hasContact(wire.fromId) || 
                         this.canReachContact(wire.fromId)
    const toReachable = this.hasContact(wire.toId) || 
                        this.canReachContact(wire.toId)
    return fromReachable && toReachable
  }
  
  /**
   * Check if we can reach a contact through peers
   */
  private canReachContact(contactId: string): boolean {
    for (const peer of this.peers.values()) {
      if (peer.ownedContacts.has(contactId)) {
        return true
      }
    }
    return false
  }
  
  /**
   * Trigger aggressive sync after partition healing
   */
  private triggerAggressiveSync(healedWires: string[]): void {
    console.log('[BasslineGossip] Starting aggressive sync for partition healing')
    
    // Prioritize healed wires
    for (const wireId of healedWires) {
      const wire = this.config.bassline.topology.wires.get(wireId)
      if (!wire) continue
      
      // Request immediate sync for contacts involved in this wire
      for (const peer of this.peers.values()) {
        if (peer.ownedContacts.has(wire.fromId) || peer.ownedContacts.has(wire.toId)) {
          this.sendCommand(peer, {
            type: 'sync-request',
            contacts: [wire.fromId, wire.toId]
          })
        }
      }
    }
  }
  
  // Connection management only - no periodic sync needed
  
  private startHeartbeat(): void {
    setInterval(() => {
      // Send heartbeat to all peers
      this.broadcast({ type: 'heartbeat' } as any)
      
      // Check for dead peers
      const now = Date.now()
      for (const [peerId, peer] of this.peers) {
        if (now - peer.lastSeen > 30000) {
          console.log(`[BasslineGossip] Peer timeout: ${peerId}`)
          peer.connection?.close()
          this.peers.delete(peerId)
        }
      }
    }, this.config.heartbeatInterval!)
  }
  
  
  // Helper methods
  
  private hasContact(contactId: string): boolean {
    const localContent = this.config.network['localContent'] as Map<string, any>
    return localContent.has(contactId)
  }
  
  private async getContent(contactId: string): Promise<any> {
    const localContent = this.config.network['localContent'] as Map<string, any>
    return localContent.get(contactId) || null
  }
  
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
  
  private hashContent(content: any): string {
    return createHash('sha256').update(JSON.stringify(content)).digest('hex')
  }
  
  private sendToPeer(peer: BasslinePeer, message: any): void {
    if (peer.connection?.readyState === WebSocket.OPEN) {
      peer.connection.send(JSON.stringify(message))
    }
  }
  
  private sendCommand(peer: BasslinePeer, message: any): void {
    this.sendToPeer(peer, message)
  }
  
  private broadcast(message: any): void {
    for (const peer of this.peers.values()) {
      this.sendToPeer(peer, message)
    }
  }
  
  private handleMessage(peer: BasslinePeer, message: any): void {
    peer.lastSeen = Date.now()
    
    switch (message.type) {
      case 'group-ownership':
        this.handleGroupOwnership(peer, message)
        break
      
      case 'initial-state':
        this.handleInitialState(peer, message)
        break
      
      case 'content-update':
        this.handleContentUpdate(peer, message)
        break
        
      case 'heartbeat':
        // Just update lastSeen (already done above)
        break
        
      default:
        // Forward other message types to network for handling
        this.config.network['handleCommand']?.(peer, message)
    }
  }
  
  private handleGroupOwnership(peer: BasslinePeer, message: any): void {
    // Update peer's ownership info
    message.groups.forEach((g: string) => peer.ownedGroups.add(g))
    message.contacts.forEach((c: string) => peer.ownedContacts.add(c))
    
    console.log(`[BasslineGossip] Received ownership from ${peer.id}: ${message.groups.length} groups, ${message.contacts.length} contacts`)
    
    // Now that we have their ownership info, set up subscriptions
    this.setupWireSubscriptions(peer)
    
    // Send initial state for contacts they need
    this.sendInitialState(peer)
  }
  
  private handleInitialState(peer: BasslinePeer, message: any): void {
    // Handle batch of initial state updates
    for (const update of message.updates) {
      this.applyRemoteUpdate(update.contactId, update.content, update.hash)
    }
    console.log(`[BasslineGossip] Received initial state: ${message.updates.length} contacts from ${peer.id}`)
  }
  
  private handleContentUpdate(peer: BasslinePeer, message: any): void {
    this.applyRemoteUpdate(message.contactId, message.content, message.hash)
  }
  
  private applyRemoteUpdate(contactId: string, content: any, hash: string): void {
    const currentHash = this.contactHashes.get(contactId)
    
    // Only apply if this is actually new content
    if (currentHash === hash) return
    
    // Update our local content and hash tracking
    this.contactHashes.set(contactId, hash)
    this.config.network['localContent'].set(contactId, content)
    
    // Trigger local propagation without re-broadcasting
    this.config.network['runtime'].scheduleUpdate(contactId, content)
    
    console.log(`[BasslineGossip] Applied remote update: ${contactId}`)
  }
  
  private updateWireHealthOnDisconnect(peer: BasslinePeer): void {
    // Mark wires involving this peer as potentially unhealthy
    for (const [wireId, wire] of this.config.bassline.topology.wires) {
      if (peer.ownedContacts.has(wire.fromId) || peer.ownedContacts.has(wire.toId)) {
        this.updateWireHealth(wireId, false)
      }
    }
  }
  
  /**
   * Shutdown the gossip layer
   */
  async shutdown(): Promise<void> {
    // Close all connections
    for (const peer of this.peers.values()) {
      peer.connection?.close()
    }
    
    // Close server and wait for it to finish
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
    }
    
    this.removeAllListeners()
  }
}

// Types for sync tasks
interface SyncTask {
  type: 'wire' | 'contact'
  wireId?: string
  contactId?: string
  peer: string
  priority: number
}

interface WireHealthInfo {
  wireId: string
  health: number  // 0-1
  lastSuccessfulSync: number
  failureCount: number
  required: boolean
}