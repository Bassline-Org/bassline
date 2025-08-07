/**
 * Gossip layer for peer-to-peer synchronization
 * Uses content-check protocol to minimize data transfer
 */

import { EventEmitter } from 'events'
import { WebSocketServer, WebSocket } from 'ws'
import { createHash } from 'crypto'
import { StorageBackedRuntime } from './StorageBackedRuntime.js'
import type { NetworkStorage } from '@bassline/core'

// Command types compatible with UI
export type GossipCommand = 
  | { type: 'content-check'; contactId: string; hash: string }
  | { type: 'content-request'; contactId: string }
  | { type: 'content-response'; contactId: string; content: any }
  | { type: 'update-contact'; contactId: string; content: any }
  | { type: 'add-contact'; groupId: string; contact: any }
  | { type: 'add-wire'; fromId: string; toId: string; wireType: string }
  | { type: 'heartbeat' }
  | { type: 'peer-announce'; peerId: string; address: string; contacts: string[] }
  | { type: 'peer-request' }
  | { type: 'peer-response'; peers: Array<{ id: string; address: string; contacts: string[]; lastSeen: number }> }

export interface GossipConfig {
  id: string
  port: number
  storage?: NetworkStorage
  peers?: string[]
  syncInterval?: number
  blacklistThreshold?: number
  maxPeers?: number // Maximum number of peers to maintain
  peerExchangeInterval?: number // How often to exchange peer info
}

interface PeerInfo {
  url: string
  ws?: WebSocket
  connected: boolean
  badScore: number
  lastSeen: number
  knownContacts: Set<string> // Contacts this peer has
  discoveredFrom?: string // Which peer told us about this one
}

export class GossipLayer extends EventEmitter {
  private runtime: StorageBackedRuntime
  private server?: WebSocket.Server
  private peers: Map<string, PeerInfo> = new Map()
  private seenHashes: Set<string> = new Set()
  private config: GossipConfig
  private syncTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private peerExchangeTimer?: NodeJS.Timeout
  
  constructor(config: GossipConfig) {
    super()
    this.config = {
      syncInterval: 30000, // 30 seconds
      blacklistThreshold: 3,
      maxPeers: 20,
      peerExchangeInterval: 60000, // 1 minute
      ...config
    }
    
    this.runtime = new StorageBackedRuntime({
      storage: config.storage,
      networkId: config.id,
      loadOnInit: true
    })
  }
  
  /**
   * Start the gossip node
   */
  async start() {
    // Start WebSocket server
    this.server = new WebSocketServer({ port: this.config.port })
    
    this.server.on('connection', (ws, req) => {
      const peerId = req.socket.remoteAddress || 'unknown'
      console.log(`[Gossip] New peer connected: ${peerId}`)
      
      this.handlePeerConnection(ws, peerId)
    })
    
    console.log(`[Gossip] Server listening on port ${this.config.port}`)
    
    // Connect to initial peers
    if (this.config.peers) {
      for (const peerUrl of this.config.peers) {
        await this.connectPeer(peerUrl)
      }
    }
    
    // Start periodic sync
    this.startSyncTimer()
    this.startHeartbeat()
    this.startPeerExchange()
  }
  
  /**
   * Connect to a peer
   */
  async connectPeer(url: string): Promise<void> {
    if (this.peers.has(url)) {
      return
    }
    
    const peerInfo: PeerInfo = {
      url,
      connected: false,
      badScore: 0,
      lastSeen: Date.now(),
      knownContacts: new Set()
    }
    
    this.peers.set(url, peerInfo)
    
    try {
      const ws = new WebSocket(url)
      
      ws.on('open', () => {
        console.log(`[Gossip] Connected to peer: ${url}`)
        peerInfo.ws = ws
        peerInfo.connected = true
        peerInfo.lastSeen = Date.now()
        
        // Start syncing with this peer
        this.syncWithPeer(url)
      })
      
      ws.on('message', (data) => {
        this.handleMessage(url, data.toString())
      })
      
      ws.on('close', () => {
        console.log(`[Gossip] Disconnected from peer: ${url}`)
        peerInfo.connected = false
        peerInfo.ws = undefined
        
        // Reconnect after delay
        setTimeout(() => this.connectPeer(url), 5000)
      })
      
      ws.on('error', (error) => {
        console.error(`[Gossip] Peer error ${url}:`, error.message)
      })
    } catch (error) {
      console.error(`[Gossip] Failed to connect to ${url}:`, error)
    }
  }
  
  /**
   * Handle incoming peer connection
   */
  private handlePeerConnection(ws: WebSocket, peerId: string) {
    const peerInfo: PeerInfo = {
      url: peerId,
      ws,
      connected: true,
      badScore: 0,
      lastSeen: Date.now(),
      knownContacts: new Set()
    }
    
    this.peers.set(peerId, peerInfo)
    
    ws.on('message', (data) => {
      this.handleMessage(peerId, data.toString())
    })
    
    ws.on('close', () => {
      console.log(`[Gossip] Peer disconnected: ${peerId}`)
      this.peers.delete(peerId)
    })
  }
  
  /**
   * Handle incoming message from peer
   */
  private async handleMessage(peerId: string, data: string) {
    try {
      const cmd: GossipCommand = JSON.parse(data)
      await this.handleCommand(peerId, cmd)
    } catch (error) {
      console.error(`[Gossip] Invalid message from ${peerId}:`, error)
      this.incrementBadScore(peerId)
    }
  }
  
  /**
   * Handle gossip command
   */
  private async handleCommand(from: string, cmd: GossipCommand) {
    const peer = this.peers.get(from)
    if (peer) {
      peer.lastSeen = Date.now()
    }
    
    switch (cmd.type) {
      case 'content-check':
        const ourHash = this.runtime.getContentHash(cmd.contactId)
        if (ourHash !== cmd.hash && !this.seenHashes.has(cmd.hash)) {
          // We need this update
          // console.log(`[Gossip ${this.config.id}] Requesting ${cmd.contactId} from ${from} (our: ${ourHash?.substring(0,8)}, theirs: ${cmd.hash.substring(0,8)})`)
          this.sendToPeer(from, {
            type: 'content-request',
            contactId: cmd.contactId
          })
        }
        break
        
      case 'content-request':
        const content = await this.runtime.getContactContent(cmd.contactId)
        if (content !== null && content !== undefined) {
          // console.log(`[Gossip ${this.config.id}] Sending ${cmd.contactId} to ${from}`)
          this.sendToPeer(from, {
            type: 'content-response',
            contactId: cmd.contactId,
            content
          })
        } else {
          // console.log(`[Gossip ${this.config.id}] Don't have ${cmd.contactId} to send to ${from}`)
        }
        break
        
      case 'content-response':
        // Apply through propagation to validate
        try {
          // console.log(`[Gossip ${this.config.id}] Received ${cmd.contactId} from ${from}`)
          this.runtime.scheduleUpdate(cmd.contactId, cmd.content)
          
          // Mark hash as seen
          const hash = this.hashContent(cmd.content)
          this.seenHashes.add(hash)
          
          // Broadcast hash to other peers
          this.broadcastExcept(from, {
            type: 'content-check',
            contactId: cmd.contactId,
            hash
          })
        } catch (error) {
          console.error(`[Gossip ${this.config.id}] Invalid update from ${from}:`, error)
          this.incrementBadScore(from)
        }
        break
        
      case 'update-contact':
        // Normal UI command
        try {
          this.runtime.scheduleUpdate(cmd.contactId, cmd.content)
          
          // Broadcast content-check
          const hash = this.hashContent(cmd.content)
          this.broadcast({
            type: 'content-check',
            contactId: cmd.contactId,
            hash
          })
        } catch (error) {
          console.error(`[Gossip] Failed to apply update:`, error)
          this.incrementBadScore(from)
        }
        break
        
      case 'heartbeat':
        // Just update last seen
        break
        
      case 'peer-announce':
        // A peer is announcing itself and what contacts it has
        this.handlePeerAnnounce(from, cmd)
        break
        
      case 'peer-request':
        // A peer wants to know about other peers
        this.handlePeerRequest(from)
        break
        
      case 'peer-response':
        // Received info about other peers
        this.handlePeerResponse(from, cmd)
        break
    }
  }
  
  /**
   * Handle peer announcement
   */
  private handlePeerAnnounce(from: string, cmd: { peerId: string; address: string; contacts: string[] }) {
    // Don't add ourselves
    if (cmd.peerId === this.config.id) return
    
    // Check if we already know this peer
    let peer = this.peers.get(cmd.peerId)
    if (!peer && this.peers.size < this.config.maxPeers!) {
      // Add new peer
      peer = {
        url: cmd.address,
        connected: false,
        badScore: 0,
        lastSeen: Date.now(),
        knownContacts: new Set(cmd.contacts),
        discoveredFrom: from
      }
      this.peers.set(cmd.peerId, peer)
      console.log(`[Gossip] Discovered new peer ${cmd.peerId} from ${from}`)
      
      // Try to connect if we have room
      if (!peer.connected) {
        this.connectPeer(cmd.address)
      }
    } else if (peer) {
      // Update known contacts
      cmd.contacts.forEach(c => peer!.knownContacts.add(c))
      peer.lastSeen = Date.now()
    }
  }
  
  /**
   * Handle peer request
   */
  private handlePeerRequest(from: string) {
    // Share our known peers
    const peers = Array.from(this.peers.entries())
      .filter(([id]) => id !== from) // Don't tell them about themselves
      .slice(0, 10) // Limit to 10 peers
      .map(([id, info]) => ({
        id,
        address: info.url,
        contacts: Array.from(info.knownContacts),
        lastSeen: info.lastSeen
      }))
    
    this.sendToPeer(from, {
      type: 'peer-response',
      peers
    })
  }
  
  /**
   * Handle peer response
   */
  private handlePeerResponse(from: string, cmd: { peers: Array<{ id: string; address: string; contacts: string[]; lastSeen: number }> }) {
    cmd.peers.forEach(peerInfo => {
      if (peerInfo.id === this.config.id) return // Skip ourselves
      
      let peer = this.peers.get(peerInfo.id)
      if (!peer && this.peers.size < this.config.maxPeers!) {
        // Add new peer
        peer = {
          url: peerInfo.address,
          connected: false,
          badScore: 0,
          lastSeen: peerInfo.lastSeen,
          knownContacts: new Set(peerInfo.contacts),
          discoveredFrom: from
        }
        this.peers.set(peerInfo.id, peer)
        console.log(`[Gossip] Learned about peer ${peerInfo.id} from ${from}`)
        
        // Try to connect
        if (!peer.connected && this.peers.size < this.config.maxPeers!) {
          this.connectPeer(peerInfo.address)
        }
      }
    })
  }
  
  /**
   * Send command to specific peer
   */
  private sendToPeer(peerId: string, cmd: GossipCommand) {
    const peer = this.peers.get(peerId)
    if (peer?.ws && peer.connected) {
      peer.ws.send(JSON.stringify(cmd))
    }
  }
  
  /**
   * Broadcast command to all peers
   */
  private broadcast(cmd: GossipCommand) {
    for (const [peerId, peer] of this.peers) {
      if (peer.ws && peer.connected) {
        peer.ws.send(JSON.stringify(cmd))
      }
    }
  }
  
  /**
   * Broadcast to all peers except one
   */
  private broadcastExcept(exceptPeerId: string, cmd: GossipCommand) {
    for (const [peerId, peer] of this.peers) {
      if (peerId !== exceptPeerId && peer.ws && peer.connected) {
        peer.ws.send(JSON.stringify(cmd))
      }
    }
  }
  
  /**
   * Sync with a specific peer
   */
  private async syncWithPeer(peerId: string) {
    const hashes = this.runtime.getAllHashes()
    
    for (const [contactId, hash] of hashes) {
      this.sendToPeer(peerId, {
        type: 'content-check',
        contactId,
        hash
      })
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  /**
   * Periodic sync with all peers
   */
  private async syncWithAllPeers() {
    const hashes = this.runtime.getAllHashes()
    
    // Send all checks in batches without delays for better performance
    const batchSize = 50
    const entries = Array.from(hashes.entries())
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      for (const [contactId, hash] of batch) {
        this.broadcast({
          type: 'content-check',
          contactId,
          hash
        })
      }
      // Only delay between batches if we have many contacts
      if (entries.length > 100) {
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }
  }
  
  /**
   * Start periodic sync timer
   */
  private startSyncTimer() {
    this.syncTimer = setInterval(() => {
      this.syncWithAllPeers()
    }, this.config.syncInterval!)
  }
  
  /**
   * Start heartbeat timer
   */
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({ type: 'heartbeat' })
      
      // Check for dead peers
      const now = Date.now()
      for (const [peerId, peer] of this.peers) {
        if (now - peer.lastSeen > 60000) { // 1 minute timeout
          console.log(`[Gossip] Peer timeout: ${peerId}`)
          if (peer.ws) {
            peer.ws.close()
          }
          this.peers.delete(peerId)
        }
      }
    }, 10000) // Every 10 seconds
  }
  
  /**
   * Start peer exchange timer
   */
  private startPeerExchange() {
    this.peerExchangeTimer = setInterval(() => {
      // Announce ourselves to all peers
      const ourContacts = Array.from(this.runtime.getAllHashes().keys())
      
      this.broadcast({
        type: 'peer-announce',
        peerId: this.config.id,
        address: `ws://localhost:${this.config.port}`,
        contacts: ourContacts
      })
      
      // Request peers from a random connected peer
      const connectedPeers = Array.from(this.peers.entries())
        .filter(([_, info]) => info.connected)
      
      if (connectedPeers.length > 0) {
        const randomPeer = connectedPeers[Math.floor(Math.random() * connectedPeers.length)]
        this.sendToPeer(randomPeer[0], { type: 'peer-request' })
      }
    }, this.config.peerExchangeInterval!)
  }
  
  /**
   * Increment bad score for peer
   */
  private incrementBadScore(peerId: string) {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.badScore++
      
      if (peer.badScore >= this.config.blacklistThreshold!) {
        console.log(`[Gossip] Blacklisting peer: ${peerId}`)
        if (peer.ws) {
          peer.ws.close()
        }
        this.peers.delete(peerId)
      }
    }
  }
  
  /**
   * Calculate content hash
   */
  private hashContent(content: any): string {
    const str = JSON.stringify(content)
    return createHash('sha256').update(str).digest('hex')
  }
  
  /**
   * Update contact (public API)
   */
  async updateContact(contactId: string, content: any) {
    this.runtime.scheduleUpdate(contactId, content)
    
    // Broadcast content-check
    const hash = this.hashContent(content)
    this.broadcast({
      type: 'content-check',
      contactId,
      hash
    })
  }
  
  /**
   * Trigger immediate sync with all peers
   */
  async triggerSync() {
    await this.syncWithAllPeers()
  }
  
  /**
   * Get content hash
   */
  getContentHash(contactId: string): string | undefined {
    return this.runtime.getContentHash(contactId)
  }
  
  /**
   * Get runtime for testing
   */
  getRuntime(): StorageBackedRuntime {
    return this.runtime
  }
  
  /**
   * Get peer score for testing
   */
  getPeerScore(peerId: string): number {
    return this.peers.get(peerId)?.badScore || 0
  }
  
  /**
   * Stop the gossip node
   */
  async stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    if (this.peerExchangeTimer) {
      clearInterval(this.peerExchangeTimer)
    }
    
    // Close all peer connections
    for (const peer of this.peers.values()) {
      if (peer.ws) {
        peer.ws.close()
      }
    }
    
    // Close server
    if (this.server) {
      this.server.close()
    }
    
    // Terminate runtime
    await this.runtime.terminate()
  }
}