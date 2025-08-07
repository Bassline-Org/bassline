/**
 * Bassline Gossip Protocol
 * 
 * Topology-aware gossip that uses Bassline structure to guide synchronization.
 * Prioritizes wire relationships and detects/heals partitions automatically.
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
  syncInterval?: number
  heartbeatInterval?: number
}

export class BasslineGossip extends EventEmitter {
  private config: GossipConfig
  private server?: WebSocketServer
  private peers = new Map<string, BasslinePeer>()
  
  // Wire health tracking
  private wireHealth = new Map<string, WireHealthInfo>()
  private brokenWires = new Set<string>()
  
  // Sync prioritization
  private syncQueue: SyncTask[] = []
  private syncInProgress = false
  
  constructor(config: GossipConfig) {
    super()
    this.config = {
      syncInterval: 5000,
      heartbeatInterval: 10000,
      ...config
    }
    
    // Initialize wire health tracking
    this.initializeWireHealth()
  }
  
  /**
   * Start the gossip server
   */
  async start(): Promise<void> {
    // Start WebSocket server
    this.server = new WebSocketServer({ port: this.config.port })
    
    this.server.on('connection', (ws, req) => {
      const peerId = req.headers['x-peer-id'] as string || 'unknown'
      this.handleIncomingPeer(ws, peerId)
    })
    
    console.log(`[BasslineGossip] Server listening on port ${this.config.port}`)
    
    // Start sync and heartbeat timers
    this.startPeriodicSync()
    this.startHeartbeat()
    this.startWireHealthCheck()
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
    
    // 3. Check for partition healing
    this.checkPartitionHealing(peer)
    
    // 4. Start wire-aware sync
    this.scheduleWireSync(peer)
    
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
   * Schedule wire-aware synchronization
   */
  private scheduleWireSync(peer: BasslinePeer): void {
    // Find wires connecting us to this peer
    const relevantWires: WireSpec[] = []
    
    for (const [wireId, wire] of this.config.bassline.topology.wires) {
      const weHaveFrom = this.hasContact(wire.fromId)
      const weHaveTo = this.hasContact(wire.toId)
      const theyHaveFrom = peer.ownedContacts.has(wire.fromId)
      const theyHaveTo = peer.ownedContacts.has(wire.toId)
      
      // This wire connects us
      if ((weHaveFrom && theyHaveTo) || (weHaveTo && theyHaveFrom)) {
        relevantWires.push(wire)
      }
    }
    
    // Sort by priority
    relevantWires.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    
    // Schedule sync tasks
    for (const wire of relevantWires) {
      this.syncQueue.push({
        type: 'wire',
        wireId: wire.id,
        peer: peer.id,
        priority: wire.priority || 1
      })
    }
    
    // Process queue
    this.processSync()
  }
  
  /**
   * Process sync queue
   */
  private async processSync(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) return
    
    this.syncInProgress = true
    
    // Sort by priority
    this.syncQueue.sort((a, b) => b.priority - a.priority)
    
    // Process top task
    const task = this.syncQueue.shift()!
    
    try {
      if (task.type === 'wire') {
        await this.syncWire(task.wireId, task.peer)
      } else if (task.type === 'contact') {
        await this.syncContact(task.contactId, task.peer)
      }
    } catch (error) {
      console.error('[BasslineGossip] Sync error:', error)
    }
    
    this.syncInProgress = false
    
    // Process next
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSync(), 100)
    }
  }
  
  /**
   * Sync a wire between peers
   */
  private async syncWire(wireId: string, peerId: string): Promise<void> {
    const wire = this.config.bassline.topology.wires.get(wireId)
    if (!wire) return
    
    const peer = this.peers.get(peerId)
    if (!peer) return
    
    // Get content for both ends
    const fromContent = await this.getContent(wire.fromId)
    const toContent = await this.getContent(wire.toId)
    
    // Send wire sync command
    this.sendToPeer(peer, {
      type: 'wire-sync',
      wireId,
      fromContent,
      toContent
    })
    
    // Update wire health
    this.updateWireHealth(wireId, true)
  }
  
  /**
   * Sync a specific contact
   */
  private async syncContact(contactId: string, peerId: string): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) return
    
    const content = await this.getContent(contactId)
    if (content !== null) {
      this.sendToPeer(peer, {
        type: 'content-update',
        contactId,
        content,
        hash: this.hashContent(content)
      })
    }
  }
  
  /**
   * Initialize wire health tracking
   */
  private initializeWireHealth(): void {
    for (const [wireId, wire] of this.config.bassline.topology.wires) {
      this.wireHealth.set(wireId, {
        wireId,
        health: 1.0,
        lastSuccessfulSync: Date.now(),
        failureCount: 0,
        required: wire.required || false
      })
    }
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
      
      // Add high-priority sync tasks
      for (const peer of this.peers.values()) {
        if (peer.ownedContacts.has(wire.fromId) || peer.ownedContacts.has(wire.toId)) {
          this.syncQueue.unshift({
            type: 'wire',
            wireId,
            peer: peer.id,
            priority: 100  // High priority
          })
        }
      }
    }
    
    this.processSync()
  }
  
  // Periodic tasks
  
  private startPeriodicSync(): void {
    setInterval(() => {
      // Sync based on wire priority
      for (const peer of this.peers.values()) {
        this.scheduleWireSync(peer)
      }
    }, this.config.syncInterval!)
  }
  
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
  
  private startWireHealthCheck(): void {
    setInterval(() => {
      this.detectBrokenWires()
      
      // Report health status
      const totalWires = this.wireHealth.size
      const healthyWires = Array.from(this.wireHealth.values())
        .filter(w => w.health > 0.7).length
      
      console.log(`[BasslineGossip] Wire health: ${healthyWires}/${totalWires} healthy`)
      
      if (this.brokenWires.size > 0) {
        console.log(`[BasslineGossip] Broken wires: ${Array.from(this.brokenWires).join(', ')}`)
      }
    }, 10000)  // Every 10 seconds
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
  
  private broadcast(message: any): void {
    for (const peer of this.peers.values()) {
      this.sendToPeer(peer, message)
    }
  }
  
  private handleMessage(peer: BasslinePeer, message: any): void {
    peer.lastSeen = Date.now()
    // Forward to network for handling
    this.config.network['handleCommand'](peer, message)
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
    
    // Close server
    this.server?.close()
    
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