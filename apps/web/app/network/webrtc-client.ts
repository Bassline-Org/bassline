import SimplePeer from 'simple-peer'
import type { NetworkClient } from './client'
import type { Change, GroupState, Group, Contact } from '@bassline/core'
import type { 
  P2PMessage, 
  P2PNetworkState, 
  WebRTCConfig, 
  SignalingMessage,
  PeerInfo,
  ChangeMessage,
  StateSync
} from './webrtc-types'

export class WebRTCNetworkClient implements NetworkClient {
  private config: WebRTCConfig
  private state: P2PNetworkState
  private signalingWs: WebSocket | null = null
  private peers: Map<string, SimplePeer.Instance> = new Map()
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map()
  private subscriptions: Map<string, Array<(changes: Change[]) => void>> = new Map()
  private messageQueue: P2PMessage[] = []
  private requestId = 0
  
  constructor(config: WebRTCConfig) {
    this.config = config
    this.state = {
      localPeerId: this.generatePeerId(),
      peers: new Map(),
      role: config.isHost ? 'host' : 'guest',
      roomCode: config.roomCode || '',
      connected: false,
      groupStates: new Map(),
      stateVersions: new Map()
    }
    
    // Initialize with root group if host
    if (this.state.role === 'host') {
      this.state.groupStates.set('root', {
        group: {
          id: 'root',
          name: 'Root Group',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: {},
        wires: {}
      })
      this.state.stateVersions.set('root', 0)
    }
  }
  
  async initialize(): Promise<void> {
    console.log('[WebRTCClient] Initializing with role:', this.state.role)
    
    // Connect to signaling server
    await this.connectSignaling()
    
    // Create or join room
    if (this.state.role === 'host') {
      await this.createRoom()
      this.state.connected = true
    } else if (this.config.roomCode) {
      await this.joinRoom(this.config.roomCode)
      // For guests, wait a bit for peer connections to establish
      await this.waitForConnection()
    }
  }
  
  private async waitForConnection(timeout: number = 10000): Promise<void> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      // Check if we have a connected host
      const hostPeer = Array.from(this.state.peers.values()).find(p => p.role === 'host' && p.connected)
      if (hostPeer) {
        console.log('[WebRTCClient] Connected to host!')
        this.state.connected = true
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Failed to connect to host within timeout')
  }
  
  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[WebRTCClient] Connecting to signaling server:', this.config.signalingUrl)
      
      this.signalingWs = new WebSocket(this.config.signalingUrl)
      
      const connectTimeout = setTimeout(() => {
        reject(new Error('Signaling server connection timeout'))
      }, 5000)
      
      this.signalingWs.onopen = () => {
        clearTimeout(connectTimeout)
        console.log('[WebRTCClient] Connected to signaling server')
        resolve()
      }
      
      this.signalingWs.onmessage = (event) => {
        try {
          const message: SignalingMessage = JSON.parse(event.data)
          this.handleSignalingMessage(message)
        } catch (error) {
          console.error('[WebRTCClient] Error parsing signaling message:', error)
        }
      }
      
      this.signalingWs.onclose = () => {
        console.log('[WebRTCClient] Disconnected from signaling server')
        // TODO: Implement reconnection logic
      }
      
      this.signalingWs.onerror = (error) => {
        console.error('[WebRTCClient] Signaling server error:', error)
        if (!this.state.connected) {
          reject(new Error('Failed to connect to signaling server'))
        }
      }
    })
  }
  
  private async createRoom(): Promise<void> {
    if (!this.state.roomCode) {
      this.state.roomCode = this.generateRoomCode()
    }
    
    console.log('[WebRTCClient] Creating room:', this.state.roomCode)
    
    this.sendSignalingMessage({
      type: 'create-room',
      roomCode: this.state.roomCode,
      peerId: this.state.localPeerId
    })
    
    return new Promise((resolve) => {
      const handler = (message: SignalingMessage) => {
        if (message.type === 'room-created') {
          console.log('[WebRTCClient] Room created successfully')
          this.state.connected = true
          resolve()
        }
      }
      this.once('room-created', handler)
    })
  }
  
  private async joinRoom(roomCode: string): Promise<void> {
    console.log('[WebRTCClient] Joining room:', roomCode)
    
    this.state.roomCode = roomCode
    
    this.sendSignalingMessage({
      type: 'join-room',
      roomCode,
      peerId: this.state.localPeerId
    })
    
    return new Promise((resolve, reject) => {
      const handler = (message: SignalingMessage) => {
        if (message.type === 'room-joined') {
          console.log('[WebRTCClient] Joined room successfully')
          resolve()
        } else if (message.type === 'error') {
          reject(new Error(message.error))
        }
      }
      this.once('room-joined', handler)
      this.once('error', handler)
    })
  }
  
  private handleSignalingMessage(message: SignalingMessage) {
    console.log('[WebRTCClient] Received signaling message:', message.type)
    
    switch (message.type) {
      case 'peer-joined':
        this.handlePeerJoined(message.peerId!, message.data?.isHost)
        break
        
      case 'peer-left':
        this.handlePeerLeft(message.peerId!)
        break
        
      case 'offer':
        this.handleOffer(message.peerId!, message.offer!)
        break
        
      case 'answer':
        this.handleAnswer(message.peerId!, message.answer!)
        break
        
      case 'ice-candidate':
        this.handleIceCandidate(message.peerId!, message.candidate!)
        break
        
      default:
        this.emit(message.type, message)
    }
  }
  
  private handlePeerJoined(peerId: string, isHost: boolean = false) {
    console.log('[WebRTCClient] Peer joined:', peerId, 'isHost:', isHost)
    
    // Add peer to state
    const peerInfo: PeerInfo = {
      id: peerId,
      role: isHost ? 'host' : 'guest',
      connected: false,
      lastSeen: Date.now()
    }
    this.state.peers.set(peerId, peerInfo)
    console.log('[WebRTCClient] Added peer to state:', peerInfo)
    
    // If we're the host, initiate connection
    if (this.state.role === 'host') {
      console.log('[WebRTCClient] Host initiating connection to:', peerId)
      this.createPeerConnection(peerId, true)
    } else if (this.state.role === 'guest' && isHost) {
      // If we're a guest and the host joined, we should also create a connection
      // but not initiate (wait for host's offer)
      console.log('[WebRTCClient] Guest preparing for connection from host:', peerId)
      this.createPeerConnection(peerId, false)
    }
  }
  
  private handlePeerLeft(peerId: string) {
    console.log('[WebRTCClient] Peer left:', peerId)
    
    // Clean up peer connection
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.destroy()
      this.peers.delete(peerId)
    }
    
    this.state.peers.delete(peerId)
    
    // TODO: Handle host migration if host left
  }
  
  private createPeerConnection(peerId: string, initiator: boolean) {
    console.log('[WebRTCClient] Creating peer connection to:', peerId, 'initiator:', initiator)
    
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      config: {
        iceServers: this.config.iceServers
      }
    })
    
    peer.on('signal', (data) => {
      console.log('[WebRTCClient] Peer signal data:', data)
      
      if (data.type === 'offer' || data.type === 'answer') {
        console.log(`[WebRTCClient] Sending ${data.type} to signaling server for peer:`, peerId)
        this.sendSignalingMessage({
          type: data.type,
          peerId: this.state.localPeerId,
          targetPeerId: peerId,  // Send to specific peer
          [data.type]: data,
          roomCode: this.state.roomCode
        } as any)
      } else if (data.type === 'candidate' && data.candidate) {
        console.log('[WebRTCClient] Sending ICE candidate to signaling server for peer:', peerId)
        this.sendSignalingMessage({
          type: 'ice-candidate',
          peerId: this.state.localPeerId,
          targetPeerId: peerId,  // Send to specific peer
          candidate: data.candidate,  // Send just the candidate, not the whole object
          roomCode: this.state.roomCode
        } as any)
      }
    })
    
    peer.on('connect', () => {
      console.log('[WebRTCClient] Connected to peer:', peerId)
      
      const peerInfo = this.state.peers.get(peerId)
      if (peerInfo) {
        peerInfo.connected = true
        peerInfo.lastSeen = Date.now()
        console.log('[WebRTCClient] Updated peer info - connected:', peerInfo.connected, 'role:', peerInfo.role)
      }
      
      // Send role announcement
      this.sendToPeer(peerId, {
        id: this.generateMessageId(),
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'role-announce',
        payload: {
          role: this.state.role,
          roomCode: this.state.roomCode
        }
      })
      
      // If we're a guest, request state from host
      if (this.state.role === 'guest' && peerInfo?.role === 'host') {
        console.log('[WebRTCClient] Guest requesting state from host')
        this.requestStateFromHost(peerId)
        this.state.connected = true  // Mark as connected once we connect to host
      }
      
      // Process queued messages
      this.processMessageQueue()
    })
    
    peer.on('data', (data) => {
      try {
        const message: P2PMessage = JSON.parse(data.toString())
        this.handlePeerMessage(peerId, message)
      } catch (error) {
        console.error('[WebRTCClient] Error parsing peer message:', error)
      }
    })
    
    peer.on('close', () => {
      console.log('[WebRTCClient] Peer connection closed:', peerId)
      const peerInfo = this.state.peers.get(peerId)
      if (peerInfo) {
        peerInfo.connected = false
      }
    })
    
    peer.on('error', (error) => {
      console.error('[WebRTCClient] Peer connection error:', peerId, error)
      // Log more details about the error
      if (error && typeof error === 'object') {
        console.error('[WebRTCClient] Error details:', {
          message: (error as any).message,
          name: (error as any).name,
          stack: (error as any).stack
        })
      }
    })
    
    this.peers.set(peerId, peer)
  }
  
  private handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    console.log('[WebRTCClient] Received offer from:', peerId)
    console.log('[WebRTCClient] Offer details:', offer)
    
    if (!this.peers.has(peerId)) {
      console.log('[WebRTCClient] Creating new peer connection for offer')
      this.createPeerConnection(peerId, false)
    }
    
    const peer = this.peers.get(peerId)
    if (peer) {
      console.log('[WebRTCClient] Signaling offer to peer')
      peer.signal(offer)
    } else {
      console.error('[WebRTCClient] Failed to get peer after creation!')
    }
  }
  
  private handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    console.log('[WebRTCClient] Received answer from:', peerId)
    console.log('[WebRTCClient] Answer details:', answer)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      console.log('[WebRTCClient] Signaling answer to peer')
      peer.signal(answer)
    } else {
      console.error('[WebRTCClient] No peer found for answer!')
    }
  }
  
  private handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    console.log('[WebRTCClient] Received ICE candidate from:', peerId)
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.signal(candidate)
    } else {
      console.error('[WebRTCClient] No peer found for ICE candidate!')
    }
  }
  
  private handlePeerMessage(peerId: string, message: P2PMessage) {
    console.log('[WebRTCClient] Received message from peer:', peerId, message.type)
    
    switch (message.type) {
      case 'state-sync':
        this.handleStateSync(message.payload as StateSync)
        break
        
      case 'state-request':
        this.handleStateRequest(peerId, message.payload)
        break
        
      case 'change':
        this.handleChange(message.payload as ChangeMessage)
        break
        
      case 'request':
        this.handleRequest(peerId, message)
        break
        
      case 'response':
        this.handleResponse(message)
        break
        
      case 'heartbeat':
        this.updatePeerLastSeen(peerId)
        break
        
      case 'role-announce':
        const peerInfo = this.state.peers.get(peerId)
        if (peerInfo) {
          peerInfo.role = message.payload.role
          console.log('[WebRTCClient] Peer', peerId, 'announced role:', message.payload.role)
          
          // If we're a guest and this is the host, mark ourselves as connected
          if (this.state.role === 'guest' && message.payload.role === 'host') {
            this.state.connected = true
            console.log('[WebRTCClient] Guest connected to host')
          }
        }
        break
    }
  }
  
  private handleStateSync(sync: StateSync) {
    console.log('[WebRTCClient] Received state sync for group:', sync.groupId)
    
    // Update our local state
    this.state.groupStates.set(sync.groupId, sync.state)
    this.state.stateVersions.set(sync.groupId, sync.version)
    
    // Notify subscribers
    const handlers = this.subscriptions.get(sync.groupId)
    if (handlers) {
      const groupState = this.convertToGroupState(sync.state)
      handlers.forEach(handler => handler([{
        type: 'state-update',
        data: groupState
      }]))
    }
  }
  
  private handleStateRequest(peerId: string, payload: { groupId: string }) {
    if (this.state.role !== 'host') {
      console.warn('[WebRTCClient] Received state request but not host')
      return
    }
    
    const state = this.state.groupStates.get(payload.groupId)
    const version = this.state.stateVersions.get(payload.groupId) || 0
    
    if (state) {
      this.sendToPeer(peerId, {
        id: this.generateMessageId(),
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'state-sync',
        payload: {
          groupId: payload.groupId,
          state,
          version
        }
      })
    }
  }
  
  private handleChange(change: ChangeMessage) {
    console.log('[WebRTCClient] Received change for group:', change.groupId)
    
    // Apply change to local state
    this.applyChangeToState(change.groupId, change.change)
    this.state.stateVersions.set(change.groupId, change.version)
    
    // Notify subscribers
    const handlers = this.subscriptions.get(change.groupId)
    if (handlers) {
      handlers.forEach(handler => handler([change.change]))
    }
    
    // If we're the host, broadcast to other peers
    if (this.state.role === 'host') {
      this.broadcastChange(change)
    }
  }
  
  private async handleRequest(peerId: string, message: P2PMessage) {
    console.log('[WebRTCClient] Handling request from peer:', peerId, message.payload.method)
    
    if (this.state.role !== 'host') {
      // Only host should handle requests
      this.sendToPeer(peerId, {
        id: message.id,
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'response',
        payload: {
          error: 'Only host can handle requests'
        }
      })
      return
    }
    
    const { method, params } = message.payload
    
    try {
      let result: any
      
      switch (method) {
        case 'registerGroup':
          await this.registerGroup(params.group)
          result = { success: true }
          break
          
        case 'scheduleUpdate':
          await this.scheduleUpdate(params.contactId, params.content)
          result = { success: true }
          break
          
        case 'connect':
          const wireId = await this.connect(params.fromId, params.toId, params.type)
          result = { wireId }
          break
          
        case 'addContact':
          const contactId = await this.addContact(params.groupId, params.contact)
          result = { contactId }
          break
          
        case 'removeContact':
          await this.removeContact(params.contactId)
          result = { success: true }
          break
          
        case 'addGroup':
          const groupId = await this.addGroup(params.parentGroupId, params.group)
          result = { groupId }
          break
          
        case 'removeGroup':
          await this.removeGroup(params.groupId)
          result = { success: true }
          break
          
        default:
          throw new Error(`Unknown method: ${method}`)
      }
      
      // Send success response
      this.sendToPeer(peerId, {
        id: message.id,
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'response',
        payload: {
          data: result
        }
      })
    } catch (error) {
      // Send error response
      this.sendToPeer(peerId, {
        id: message.id,
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'response',
        payload: {
          error: error instanceof Error ? error.message : 'Request failed'
        }
      })
    }
  }
  
  private handleResponse(message: P2PMessage) {
    const pending = this.pendingRequests.get(message.id)
    if (pending) {
      this.pendingRequests.delete(message.id)
      if (message.payload.error) {
        pending.reject(new Error(message.payload.error))
      } else {
        pending.resolve(message.payload.data)
      }
    }
  }
  
  private requestStateFromHost(hostPeerId: string) {
    console.log('[WebRTCClient] Requesting state from host')
    
    this.sendToPeer(hostPeerId, {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      from: this.state.localPeerId,
      type: 'state-request',
      payload: {
        groupId: 'root'
      }
    })
  }
  
  private sendToPeer(peerId: string, message: P2PMessage) {
    const peer = this.peers.get(peerId)
    if (peer && peer.connected) {
      peer.send(JSON.stringify(message))
    } else {
      console.warn('[WebRTCClient] Cannot send to disconnected peer:', peerId)
      this.messageQueue.push(message)
    }
  }
  
  private broadcast(message: P2PMessage) {
    this.peers.forEach((peer, peerId) => {
      if (peer.connected) {
        peer.send(JSON.stringify(message))
      }
    })
  }
  
  private broadcastChange(change: ChangeMessage) {
    const message: P2PMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      from: this.state.localPeerId,
      type: 'change',
      payload: change
    }
    
    this.broadcast(message)
  }
  
  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!
      // Try to send to any connected peer
      for (const [peerId, peer] of this.peers) {
        if (peer.connected) {
          peer.send(JSON.stringify(message))
          break
        }
      }
    }
  }
  
  private sendSignalingMessage(message: SignalingMessage) {
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message))
    } else {
      console.error('[WebRTCClient] Cannot send signaling message - not connected')
    }
  }
  
  private updatePeerLastSeen(peerId: string) {
    const peerInfo = this.state.peers.get(peerId)
    if (peerInfo) {
      peerInfo.lastSeen = Date.now()
    }
  }
  
  private applyChangeToState(groupId: string, change: Change) {
    const state = this.state.groupStates.get(groupId)
    if (!state) return
    
    // Apply change based on type
    // This is similar to WebSocketClient implementation
    switch (change.type) {
      case 'contact-added':
        if (!state.contacts) state.contacts = {}
        const addData = change.data as any
        state.contacts[addData.contact.id] = addData.contact
        break
        
      case 'contact-updated':
        if (state.contacts && (change.data as any).contactId) {
          const data = change.data as any
          if (data.contact) {
            state.contacts[data.contactId] = data.contact
          } else if (data.updates) {
            state.contacts[data.contactId] = {
              ...state.contacts[data.contactId],
              ...data.updates
            }
          }
        }
        break
        
      case 'contact-removed':
        if (state.contacts) {
          const removeData = change.data as any
          delete state.contacts[removeData.contactId]
        }
        break
        
      case 'wire-added':
        if (!state.wires) state.wires = {}
        const wireAddData = change.data as any
        state.wires[wireAddData.wire.id] = wireAddData.wire
        break
        
      case 'wire-removed':
        if (state.wires) {
          const wireRemoveData = change.data as any
          delete state.wires[wireRemoveData.wireId]
        }
        break
    }
  }
  
  private convertToGroupState(state: any): GroupState {
    return {
      group: state.group,
      contacts: new Map(Object.entries(state.contacts || {})),
      wires: new Map(Object.entries(state.wires || {}))
    }
  }
  
  // Event emitter helpers
  private eventHandlers: Map<string, Function[]> = new Map()
  
  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }
  
  private once(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    const wrappedHandler = (data: any) => {
      handler(data)
      this.off(event, wrappedHandler)
    }
    this.eventHandlers.get(event)!.push(wrappedHandler)
  }
  
  private off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  // Utility methods
  private generatePeerId(): string {
    return Math.random().toString(36).substring(2, 15)
  }
  
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }
  
  private generateMessageId(): string {
    return `${this.state.localPeerId}-${this.requestId++}`
  }
  
  // NetworkClient interface implementation
  async getState(groupId: string): Promise<GroupState> {
    // If we're the host or have cached state, return it
    if (this.state.role === 'host' || this.state.groupStates.has(groupId)) {
      const state = this.state.groupStates.get(groupId)
      if (state) {
        return this.convertToGroupState(state)
      }
    }
    
    // Otherwise, request from host
    const hostPeer = Array.from(this.state.peers.values()).find(p => p.role === 'host')
    if (hostPeer && hostPeer.connected) {
      // Send request and wait for response
      // This would need to be implemented with proper request/response handling
      throw new Error('State request not yet fully implemented')
    }
    
    // Return empty state as fallback
    return {
      group: {
        id: groupId,
        name: 'Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts: new Map(),
      wires: new Map()
    }
  }
  
  subscribe(groupId: string, handler: (changes: Change[]) => void): () => void {
    if (!this.subscriptions.has(groupId)) {
      this.subscriptions.set(groupId, [])
    }
    
    const handlers = this.subscriptions.get(groupId)!
    handlers.push(handler)
    
    return () => {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  // NetworkClient method implementations
  
  async registerGroup(group: Group): Promise<void> {
    if (this.state.role === 'host') {
      // Host can directly modify state
      this.state.groupStates.set(group.id, {
        group,
        contacts: {},
        wires: {}
      })
      this.state.stateVersions.set(group.id, 0)
    } else {
      // Guest sends request to host
      await this.sendRequestToHost('registerGroup', { group })
    }
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
    // Find which group contains this contact
    let groupId: string | null = null
    for (const [gId, state] of this.state.groupStates) {
      if (state.contacts && state.contacts[contactId]) {
        groupId = gId
        break
      }
    }
    
    if (!groupId) {
      throw new Error(`Contact ${contactId} not found`)
    }
    
    if (this.state.role === 'host') {
      // Host updates state directly
      const state = this.state.groupStates.get(groupId)
      if (state && state.contacts && state.contacts[contactId]) {
        state.contacts[contactId].content = content
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        // Broadcast change to all peers
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-updated',
            data: {
              contactId,
              updates: { content }
            }
          },
          version
        }
        this.broadcastChange(change)
        
        // Notify local subscribers
        const handlers = this.subscriptions.get(groupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      // Guest sends request to host
      await this.sendRequestToHost('scheduleUpdate', { contactId, content })
    }
  }
  
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    const wireId = this.generateWireId()
    
    // Find which group contains these contacts
    let groupId: string | null = null
    for (const [gId, state] of this.state.groupStates) {
      if (state.contacts && (state.contacts[fromId] || state.contacts[toId])) {
        groupId = gId
        break
      }
    }
    
    if (!groupId) {
      throw new Error('Contacts not found')
    }
    
    if (this.state.role === 'host') {
      // Host creates wire directly
      const state = this.state.groupStates.get(groupId)
      if (state) {
        if (!state.wires) state.wires = {}
        state.wires[wireId] = {
          id: wireId,
          fromId,
          toId,
          type
        }
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        // Broadcast change
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'wire-added',
            data: {
              wire: state.wires[wireId]
            }
          },
          version
        }
        this.broadcastChange(change)
        
        // Notify local subscribers
        const handlers = this.subscriptions.get(groupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      // Guest sends request to host
      const result = await this.sendRequestToHost('connect', { fromId, toId, type })
      return result.wireId
    }
    
    return wireId
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    const contactId = this.generateContactId()
    const fullContact = { ...contact, id: contactId }
    
    if (this.state.role === 'host') {
      // Host adds contact directly
      const state = this.state.groupStates.get(groupId)
      if (state) {
        if (!state.contacts) state.contacts = {}
        state.contacts[contactId] = fullContact
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        // Broadcast change
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-added',
            data: {
              contact: fullContact,
              contactId
            }
          },
          version
        }
        this.broadcastChange(change)
        
        // Notify local subscribers
        const handlers = this.subscriptions.get(groupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      // Guest sends request to host
      const result = await this.sendRequestToHost('addContact', { groupId, contact })
      return result.contactId
    }
    
    return contactId
  }
  
  async removeContact(contactId: string): Promise<void> {
    // Find which group contains this contact
    let groupId: string | null = null
    for (const [gId, state] of this.state.groupStates) {
      if (state.contacts && state.contacts[contactId]) {
        groupId = gId
        break
      }
    }
    
    if (!groupId) {
      throw new Error(`Contact ${contactId} not found`)
    }
    
    if (this.state.role === 'host') {
      // Host removes contact directly
      const state = this.state.groupStates.get(groupId)
      if (state && state.contacts) {
        delete state.contacts[contactId]
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        // Broadcast change
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-removed',
            data: { contactId }
          },
          version
        }
        this.broadcastChange(change)
        
        // Notify local subscribers
        const handlers = this.subscriptions.get(groupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      // Guest sends request to host
      await this.sendRequestToHost('removeContact', { contactId })
    }
  }
  
  async addGroup(parentGroupId: string, group: any): Promise<string> {
    const groupId = this.generateGroupId()
    const fullGroup = {
      id: groupId,
      parentId: parentGroupId,
      name: group.name || 'New Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      ...group
    }
    
    if (this.state.role === 'host') {
      // Host adds group directly
      this.state.groupStates.set(groupId, {
        group: fullGroup,
        contacts: {},
        wires: {}
      })
      this.state.stateVersions.set(groupId, 0)
      
      // Update parent group
      const parentState = this.state.groupStates.get(parentGroupId)
      if (parentState) {
        if (!parentState.group.subgroupIds) {
          parentState.group.subgroupIds = []
        }
        parentState.group.subgroupIds.push(groupId)
        
        const version = (this.state.stateVersions.get(parentGroupId) || 0) + 1
        this.state.stateVersions.set(parentGroupId, version)
        
        // Broadcast change
        const change: ChangeMessage = {
          groupId: parentGroupId,
          change: {
            type: 'group-added',
            data: { group: fullGroup }
          },
          version
        }
        this.broadcastChange(change)
        
        // Notify local subscribers
        const handlers = this.subscriptions.get(parentGroupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      // Guest sends request to host
      const result = await this.sendRequestToHost('addGroup', { parentGroupId, group })
      return result.groupId
    }
    
    return groupId
  }
  
  async removeGroup(groupId: string): Promise<void> {
    if (this.state.role === 'host') {
      // Find parent group
      let parentGroupId: string | null = null
      const groupState = this.state.groupStates.get(groupId)
      if (groupState && groupState.group.parentId) {
        parentGroupId = groupState.group.parentId
      }
      
      // Remove group
      this.state.groupStates.delete(groupId)
      this.state.stateVersions.delete(groupId)
      
      // Update parent
      if (parentGroupId) {
        const parentState = this.state.groupStates.get(parentGroupId)
        if (parentState && parentState.group.subgroupIds) {
          parentState.group.subgroupIds = parentState.group.subgroupIds.filter(
            id => id !== groupId
          )
          
          const version = (this.state.stateVersions.get(parentGroupId) || 0) + 1
          this.state.stateVersions.set(parentGroupId, version)
          
          // Broadcast change
          const change: ChangeMessage = {
            groupId: parentGroupId,
            change: {
              type: 'group-removed',
              data: { groupId }
            },
            version
          }
          this.broadcastChange(change)
          
          // Notify local subscribers
          const handlers = this.subscriptions.get(parentGroupId)
          if (handlers) {
            handlers.forEach(handler => handler([change.change]))
          }
        }
      }
    } else {
      // Guest sends request to host
      await this.sendRequestToHost('removeGroup', { groupId })
    }
  }
  
  // Helper method to send requests to host
  private async sendRequestToHost(method: string, params: any): Promise<any> {
    console.log('[WebRTCClient] sendRequestToHost:', method, 'peers:', this.state.peers.size)
    
    // Log all peers for debugging
    this.state.peers.forEach((peer, id) => {
      console.log(`[WebRTCClient] Peer ${id}: role=${peer.role}, connected=${peer.connected}`)
    })
    
    const hostPeer = Array.from(this.state.peers.values()).find(p => p.role === 'host' && p.connected)
    if (!hostPeer || !hostPeer.connected) {
      console.error('[WebRTCClient] No connected host found!')
      console.error('[WebRTCClient] State:', {
        role: this.state.role,
        connected: this.state.connected,
        peers: Array.from(this.state.peers.entries()).map(([id, p]) => ({
          id,
          role: p.role,
          connected: p.connected
        }))
      })
      throw new Error('Not connected to host')
    }
    
    console.log('[WebRTCClient] Found host peer:', hostPeer.id)
    
    return new Promise((resolve, reject) => {
      const requestId = this.generateMessageId()
      
      this.pendingRequests.set(requestId, { resolve, reject })
      
      this.sendToPeer(hostPeer.id, {
        id: requestId,
        timestamp: Date.now(),
        from: this.state.localPeerId,
        type: 'request',
        payload: {
          method,
          params
        }
      })
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }
  
  // ID generation helpers
  private generateWireId(): string {
    return `wire-${Math.random().toString(36).substring(2, 11)}`
  }
  
  private generateContactId(): string {
    return `contact-${Math.random().toString(36).substring(2, 11)}`
  }
  
  private generateGroupId(): string {
    return `group-${Math.random().toString(36).substring(2, 11)}`
  }
  
  // Additional methods for compatibility
  async disconnect(wireId: string): Promise<void> {
    // Find which group contains this wire
    let groupId: string | null = null
    for (const [gId, state] of this.state.groupStates) {
      if (state.wires && state.wires[wireId]) {
        groupId = gId
        break
      }
    }
    
    if (!groupId) {
      throw new Error(`Wire ${wireId} not found`)
    }
    
    if (this.state.role === 'host') {
      const state = this.state.groupStates.get(groupId)
      if (state && state.wires) {
        delete state.wires[wireId]
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'wire-removed',
            data: { wireId }
          },
          version
        }
        this.broadcastChange(change)
        
        const handlers = this.subscriptions.get(groupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      await this.sendRequestToHost('disconnect', { wireId })
    }
  }
  
  async getContact(contactId: string): Promise<Contact | undefined> {
    for (const [_, state] of this.state.groupStates) {
      if (state.contacts && state.contacts[contactId]) {
        return state.contacts[contactId]
      }
    }
    return undefined
  }
  
  async getWire(wireId: string): Promise<any | undefined> {
    for (const [_, state] of this.state.groupStates) {
      if (state.wires && state.wires[wireId]) {
        return state.wires[wireId]
      }
    }
    return undefined
  }
  
  async setScheduler(strategy: 'immediate' | 'batch', options?: any): Promise<void> {
    // No-op for WebRTC - always immediate
    console.log('[WebRTCClient] Scheduler setting ignored - P2P always uses immediate propagation')
  }
  
  async applyRefactoring(operation: string, params: any): Promise<any> {
    if (this.state.role === 'host') {
      throw new Error('Refactoring not yet implemented for WebRTC')
    } else {
      return await this.sendRequestToHost('applyRefactoring', { operation, params })
    }
  }
  
  async schedulePropagation(fromContactId: string, toContactId: string, content: unknown): Promise<void> {
    // Just update the target contact
    await this.scheduleUpdate(toContactId, content)
  }
  
  terminate(): void {
    // Clean up connections
    this.peers.forEach(peer => peer.destroy())
    this.peers.clear()
    
    if (this.signalingWs) {
      this.signalingWs.close()
      this.signalingWs = null
    }
    
    this.subscriptions.clear()
    this.pendingRequests.clear()
    this.messageQueue = []
  }
}