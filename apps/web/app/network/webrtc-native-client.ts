import type { NetworkClient } from '@bassline/core'
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

interface PeerConnection {
  id: string
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  role: 'host' | 'guest'
  connected: boolean
}

export class NativeWebRTCClient implements NetworkClient {
  private config: WebRTCConfig
  private state: P2PNetworkState
  private signalingWs: WebSocket | null = null
  private peers: Map<string, PeerConnection> = new Map()
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
    console.log('[WebRTC] Initializing with role:', this.state.role)
    
    // Connect to signaling server
    await this.connectSignaling()
    
    // Create or join room
    if (this.state.role === 'host') {
      await this.createRoom()
      this.state.connected = true
    } else if (this.config.roomCode) {
      await this.joinRoom(this.config.roomCode)
      // For guests, wait for peer connection
      await this.waitForConnection()
    }
  }
  
  private async waitForConnection(timeout: number = 10000): Promise<void> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      // Check if we have a connected host
      const hostPeer = Array.from(this.peers.values()).find(p => p.role === 'host' && p.connected)
      if (hostPeer) {
        console.log('[WebRTC] Connected to host!')
        this.state.connected = true
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Failed to connect to host within timeout')
  }
  
  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[WebRTC] Connecting to signaling server:', this.config.signalingUrl)
      
      this.signalingWs = new WebSocket(this.config.signalingUrl)
      
      const connectTimeout = setTimeout(() => {
        reject(new Error('Signaling server connection timeout'))
      }, 5000)
      
      this.signalingWs.onopen = () => {
        clearTimeout(connectTimeout)
        console.log('[WebRTC] Connected to signaling server')
        resolve()
      }
      
      this.signalingWs.onmessage = (event) => {
        try {
          const message: SignalingMessage = JSON.parse(event.data)
          this.handleSignalingMessage(message)
        } catch (error) {
          console.error('[WebRTC] Error parsing signaling message:', error)
        }
      }
      
      this.signalingWs.onclose = () => {
        console.log('[WebRTC] Disconnected from signaling server')
      }
      
      this.signalingWs.onerror = (error) => {
        console.error('[WebRTC] Signaling server error:', error)
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
    
    console.log('[WebRTC] Creating room:', this.state.roomCode)
    
    this.sendSignalingMessage({
      type: 'create-room',
      roomCode: this.state.roomCode,
      peerId: this.state.localPeerId
    })
    
    return new Promise((resolve) => {
      const handler = (message: SignalingMessage) => {
        if (message.type === 'room-created') {
          console.log('[WebRTC] Room created successfully')
          resolve()
        }
      }
      this.once('room-created', handler)
    })
  }
  
  private async joinRoom(roomCode: string): Promise<void> {
    console.log('[WebRTC] Joining room:', roomCode)
    
    this.state.roomCode = roomCode
    
    this.sendSignalingMessage({
      type: 'join-room',
      roomCode,
      peerId: this.state.localPeerId
    })
    
    return new Promise((resolve, reject) => {
      const handler = (message: SignalingMessage) => {
        if (message.type === 'room-joined') {
          console.log('[WebRTC] Joined room successfully')
          resolve()
        } else if (message.type === 'error') {
          reject(new Error(message.error))
        }
      }
      this.once('room-joined', handler)
      this.once('error', handler)
    })
  }
  
  private async createPeerConnection(peerId: string, isInitiator: boolean): Promise<void> {
    console.log('[WebRTC] Creating peer connection to:', peerId, 'initiator:', isInitiator)
    
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers
    })
    
    const peerConn: PeerConnection = {
      id: peerId,
      pc,
      dc: null,
      role: 'guest', // Will be updated when peer announces role
      connected: false
    }
    
    // Set up ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate to:', peerId)
        this.sendSignalingMessage({
          type: 'ice-candidate',
          peerId: this.state.localPeerId,
          targetPeerId: peerId,
          candidate: event.candidate,
          roomCode: this.state.roomCode
        } as any)
      }
    }
    
    // Set up connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState)
      if (pc.connectionState === 'connected') {
        peerConn.connected = true
        const peerInfo = this.state.peers.get(peerId)
        if (peerInfo) {
          peerInfo.connected = true
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        peerConn.connected = false
        const peerInfo = this.state.peers.get(peerId)
        if (peerInfo) {
          peerInfo.connected = false
        }
      }
    }
    
    if (isInitiator) {
      // Create data channel
      const dc = pc.createDataChannel('data', {
        ordered: true
      })
      
      dc.onopen = () => {
        console.log('[WebRTC] Data channel opened to:', peerId)
        peerConn.dc = dc
        peerConn.connected = true
        this.onPeerConnected(peerId)
      }
      
      dc.onmessage = (event) => {
        this.handleDataChannelMessage(peerId, event.data)
      }
      
      dc.onclose = () => {
        console.log('[WebRTC] Data channel closed:', peerId)
        peerConn.connected = false
      }
      
      peerConn.dc = dc
      
      // Create offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      console.log('[WebRTC] Sending offer to:', peerId)
      this.sendSignalingMessage({
        type: 'offer',
        peerId: this.state.localPeerId,
        targetPeerId: peerId,
        offer,
        roomCode: this.state.roomCode
      } as any)
    } else {
      // Wait for data channel from initiator
      pc.ondatachannel = (event) => {
        const dc = event.channel
        console.log('[WebRTC] Received data channel from:', peerId)
        
        dc.onopen = () => {
          console.log('[WebRTC] Data channel opened from:', peerId)
          peerConn.dc = dc
          peerConn.connected = true
          this.onPeerConnected(peerId)
        }
        
        dc.onmessage = (event) => {
          this.handleDataChannelMessage(peerId, event.data)
        }
        
        dc.onclose = () => {
          console.log('[WebRTC] Data channel closed:', peerId)
          peerConn.connected = false
        }
        
        peerConn.dc = dc
      }
    }
    
    this.peers.set(peerId, peerConn)
  }
  
  private handleSignalingMessage(message: SignalingMessage) {
    console.log('[WebRTC] Received signaling message:', message.type)
    
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
  
  private async handlePeerJoined(peerId: string, isHost: boolean = false) {
    console.log('[WebRTC] Peer joined:', peerId, 'isHost:', isHost)
    
    // Add peer to state
    const peerInfo: PeerInfo = {
      id: peerId,
      role: isHost ? 'host' : 'guest',
      connected: false,
      lastSeen: Date.now()
    }
    this.state.peers.set(peerId, peerInfo)
    
    // If we're the host, initiate connection
    if (this.state.role === 'host') {
      await this.createPeerConnection(peerId, true)
    }
  }
  
  private handlePeerLeft(peerId: string) {
    console.log('[WebRTC] Peer left:', peerId)
    
    // Clean up peer connection
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.pc.close()
      this.peers.delete(peerId)
    }
    
    this.state.peers.delete(peerId)
  }
  
  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    console.log('[WebRTC] Received offer from:', peerId)
    
    if (!this.peers.has(peerId)) {
      await this.createPeerConnection(peerId, false)
    }
    
    const peer = this.peers.get(peerId)
    if (peer) {
      await peer.pc.setRemoteDescription(offer)
      const answer = await peer.pc.createAnswer()
      await peer.pc.setLocalDescription(answer)
      
      console.log('[WebRTC] Sending answer to:', peerId)
      this.sendSignalingMessage({
        type: 'answer',
        peerId: this.state.localPeerId,
        targetPeerId: peerId,
        answer,
        roomCode: this.state.roomCode
      } as any)
    }
  }
  
  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    console.log('[WebRTC] Received answer from:', peerId)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      await peer.pc.setRemoteDescription(answer)
    }
  }
  
  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    console.log('[WebRTC] Received ICE candidate from:', peerId)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      try {
        await peer.pc.addIceCandidate(candidate)
      } catch (error) {
        console.error('[WebRTC] Error adding ICE candidate:', error)
      }
    }
  }
  
  private onPeerConnected(peerId: string) {
    console.log('[WebRTC] Peer connected:', peerId)
    
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
    
    // If we're a guest, wait a bit then request state from host
    // The delay ensures the host has received our role announcement
    const peer = this.peers.get(peerId)
    if (this.state.role === 'guest') {
      setTimeout(() => {
        const updatedPeer = this.peers.get(peerId)
        if (updatedPeer && updatedPeer.role === 'host') {
          console.log('[WebRTC] Guest requesting initial state from host')
          this.requestStateFromHost(peerId)
        }
      }, 100)
    }
  }
  
  private handleDataChannelMessage(peerId: string, data: string) {
    try {
      const message: P2PMessage = JSON.parse(data)
      this.handlePeerMessage(peerId, message)
    } catch (error) {
      console.error('[WebRTC] Error parsing peer message:', error)
    }
  }
  
  private handlePeerMessage(peerId: string, message: P2PMessage) {
    console.log('[WebRTC] Received message from peer:', peerId, message.type)
    
    switch (message.type) {
      case 'role-announce':
        const peer = this.peers.get(peerId)
        if (peer) {
          peer.role = message.payload.role
          const peerInfo = this.state.peers.get(peerId)
          if (peerInfo) {
            peerInfo.role = message.payload.role
          }
          
          // If we're a guest and this is the host, mark ourselves as connected
          if (this.state.role === 'guest' && message.payload.role === 'host') {
            this.state.connected = true
            console.log('[WebRTC] Guest connected to host')
          }
        }
        break
        
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
    }
  }
  
  private requestStateFromHost(peerId: string) {
    console.log('[WebRTC] Requesting state from host for root group')
    
    // First ensure we have a placeholder for root group
    if (!this.state.groupStates.has('root')) {
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
    
    this.sendToPeer(peerId, {
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
    if (peer && peer.dc && peer.dc.readyState === 'open') {
      peer.dc.send(JSON.stringify(message))
    } else {
      console.warn('[WebRTC] Cannot send to peer:', peerId, 'not connected')
      this.messageQueue.push(message)
    }
  }
  
  private broadcast(message: P2PMessage) {
    this.peers.forEach((peer, peerId) => {
      if (peer.dc && peer.dc.readyState === 'open') {
        peer.dc.send(JSON.stringify(message))
      }
    })
  }
  
  private sendSignalingMessage(message: SignalingMessage) {
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message))
    } else {
      console.error('[WebRTC] Cannot send signaling message - not connected')
    }
  }
  
  private updatePeerLastSeen(peerId: string) {
    const peerInfo = this.state.peers.get(peerId)
    if (peerInfo) {
      peerInfo.lastSeen = Date.now()
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
  
  // State sync methods (same as before)
  private handleStateSync(sync: StateSync) {
    console.log('[WebRTC] Received state sync for group:', sync.groupId)
    console.log('[WebRTC] State sync details:', {
      groupId: sync.groupId,
      hasGroup: !!sync.state?.group,
      contactCount: Object.keys(sync.state?.contacts || {}).length,
      wireCount: Object.keys(sync.state?.wires || {}).length,
      version: sync.version
    })
    
    // Ensure the state has the required structure
    const normalizedState = {
      group: sync.state.group || {
        id: sync.groupId,
        name: sync.groupId === 'root' ? 'Root Group' : 'Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts: sync.state.contacts || {},
      wires: sync.state.wires || {}
    }
    
    this.state.groupStates.set(sync.groupId, normalizedState)
    this.state.stateVersions.set(sync.groupId, sync.version)
    
    const handlers = this.subscriptions.get(sync.groupId)
    if (handlers) {
      const groupState = this.convertToGroupState(normalizedState)
      handlers.forEach(handler => handler([{
        type: 'state-update',
        data: groupState
      }]))
    }
  }
  
  private handleStateRequest(peerId: string, payload: { groupId: string }) {
    if (this.state.role !== 'host') {
      console.warn('[WebRTC] Received state request but not host')
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
    console.log('[WebRTC] Received change for group:', change.groupId)
    
    // If we don't have the state for this group yet, we need to request it first
    if (!this.state.groupStates.has(change.groupId)) {
      console.warn('[WebRTC] Received change for unknown group, requesting state:', change.groupId)
      
      // Find the host and request state
      const hostPeer = Array.from(this.peers.values()).find(p => p.role === 'host')
      if (hostPeer) {
        this.sendToPeer(hostPeer.id, {
          id: this.generateMessageId(),
          timestamp: Date.now(),
          from: this.state.localPeerId,
          type: 'state-request',
          payload: {
            groupId: change.groupId
          }
        })
      }
      
      // Don't process this change since we don't have the base state
      return
    }
    
    this.applyChangeToState(change.groupId, change.change)
    this.state.stateVersions.set(change.groupId, change.version)
    
    const handlers = this.subscriptions.get(change.groupId)
    if (handlers) {
      handlers.forEach(handler => handler([change.change]))
    }
    
    // Only host should broadcast changes to other peers
    if (this.state.role === 'host') {
      this.broadcastChange(change)
    }
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
  
  private async handleRequest(peerId: string, message: P2PMessage) {
    console.log('[WebRTC] Handling request from peer:', peerId, message.payload.method)
    
    if (this.state.role !== 'host') {
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
          
        case 'disconnect':
          await this.disconnect(params.wireId)
          result = { success: true }
          break
          
        default:
          throw new Error(`Unknown method: ${method}`)
      }
      
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
  
  private applyChangeToState(groupId: string, change: Change) {
    const state = this.state.groupStates.get(groupId)
    if (!state) {
      console.warn('[WebRTC] No state found for group:', groupId)
      return
    }
    
    console.log('[WebRTC] Applying change to state:', change.type, 'for group:', groupId)
    
    switch (change.type) {
      case 'contact-added':
        if (!state.contacts) state.contacts = {}
        const addData = change.data as any
        if (addData.contact) {
          state.contacts[addData.contact.id] = addData.contact
          console.log('[WebRTC] Added contact:', addData.contact.id)
        }
        break
        
      case 'contact-updated':
        if (state.contacts) {
          const data = change.data as any
          if (data.contactId && data.updates) {
            if (state.contacts[data.contactId]) {
              state.contacts[data.contactId] = {
                ...state.contacts[data.contactId],
                ...data.updates
              }
              console.log('[WebRTC] Updated contact:', data.contactId)
            }
          } else if (data.contact) {
            state.contacts[data.contact.id] = data.contact
            console.log('[WebRTC] Replaced contact:', data.contact.id)
          }
        }
        break
        
      case 'contact-removed':
        if (state.contacts) {
          const removeData = change.data as any
          if (removeData.contactId) {
            delete state.contacts[removeData.contactId]
            console.log('[WebRTC] Removed contact:', removeData.contactId)
          }
        }
        break
        
      case 'wire-added':
        if (!state.wires) state.wires = {}
        const wireAddData = change.data as any
        if (wireAddData.wire) {
          state.wires[wireAddData.wire.id] = wireAddData.wire
          console.log('[WebRTC] Added wire:', wireAddData.wire.id)
        }
        break
        
      case 'wire-removed':
        if (state.wires) {
          const wireRemoveData = change.data as any
          if (wireRemoveData.wireId) {
            delete state.wires[wireRemoveData.wireId]
            console.log('[WebRTC] Removed wire:', wireRemoveData.wireId)
          }
        }
        break
        
      case 'group-added':
        if (!state.group.subgroupIds) {
          state.group.subgroupIds = []
        }
        const groupAddData = change.data as any
        if (groupAddData.group && !state.group.subgroupIds.includes(groupAddData.group.id)) {
          state.group.subgroupIds.push(groupAddData.group.id)
          console.log('[WebRTC] Added subgroup:', groupAddData.group.id)
        }
        break
        
      case 'group-removed':
        if (state.group.subgroupIds) {
          const groupRemoveData = change.data as any
          if (groupRemoveData.groupId) {
            state.group.subgroupIds = state.group.subgroupIds.filter(
              (id: string) => id !== groupRemoveData.groupId
            )
            console.log('[WebRTC] Removed subgroup:', groupRemoveData.groupId)
          }
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
  
  private async sendRequestToHost(method: string, params: any): Promise<any> {
    const hostPeer = Array.from(this.peers.values()).find(p => p.role === 'host' && p.connected)
    if (!hostPeer) {
      throw new Error('Not connected to host')
    }
    
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
      
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }
  
  // NetworkClient interface implementation
  async getState(groupId: string): Promise<GroupState> {
    if (this.state.role === 'host' || this.state.groupStates.has(groupId)) {
      const state = this.state.groupStates.get(groupId)
      if (state) {
        return this.convertToGroupState(state)
      }
    }
    
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
  
  // All the CRUD operations (same as before)
  async registerGroup(group: Group): Promise<void> {
    if (this.state.role === 'host') {
      this.state.groupStates.set(group.id, {
        group,
        contacts: {},
        wires: {}
      })
      this.state.stateVersions.set(group.id, 0)
    } else {
      await this.sendRequestToHost('registerGroup', { group })
    }
  }
  
  async scheduleUpdate(contactId: string, content: unknown): Promise<void> {
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
      const state = this.state.groupStates.get(groupId)
      if (state && state.contacts && state.contacts[contactId]) {
        state.contacts[contactId].content = content
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-updated',
            data: {
              contactId,
              groupId,  // Include groupId in the data
              updates: { content }
            }
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
      await this.sendRequestToHost('scheduleUpdate', { contactId, content })
    }
  }
  
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    const wireId = `wire-${Math.random().toString(36).substring(2, 11)}`
    
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
        
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'wire-added',
            data: {
              wire: state.wires[wireId],
              groupId  // Include groupId in the data
            }
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
      const result = await this.sendRequestToHost('connect', { fromId, toId, type })
      return result.wireId
    }
    
    return wireId
  }
  
  async addContact(groupId: string, contact: Omit<Contact, 'id'>): Promise<string> {
    const contactId = `contact-${Math.random().toString(36).substring(2, 11)}`
    const fullContact = { ...contact, id: contactId, groupId }
    
    if (this.state.role === 'host') {
      const state = this.state.groupStates.get(groupId)
      if (state) {
        if (!state.contacts) state.contacts = {}
        state.contacts[contactId] = fullContact
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-added',
            data: {
              contact: fullContact,
              contactId,
              groupId  // Include groupId in the data
            }
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
      const result = await this.sendRequestToHost('addContact', { groupId, contact })
      return result.contactId
    }
    
    return contactId
  }
  
  async removeContact(contactId: string): Promise<void> {
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
      const state = this.state.groupStates.get(groupId)
      if (state && state.contacts) {
        delete state.contacts[contactId]
        
        const version = (this.state.stateVersions.get(groupId) || 0) + 1
        this.state.stateVersions.set(groupId, version)
        
        const change: ChangeMessage = {
          groupId,
          change: {
            type: 'contact-removed',
            data: { 
              contactId,
              groupId  // Include groupId in the data
            }
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
      await this.sendRequestToHost('removeContact', { contactId })
    }
  }
  
  async addGroup(parentGroupId: string, group: any): Promise<string> {
    const groupId = `group-${Math.random().toString(36).substring(2, 11)}`
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
      this.state.groupStates.set(groupId, {
        group: fullGroup,
        contacts: {},
        wires: {}
      })
      this.state.stateVersions.set(groupId, 0)
      
      const parentState = this.state.groupStates.get(parentGroupId)
      if (parentState) {
        if (!parentState.group.subgroupIds) {
          parentState.group.subgroupIds = []
        }
        parentState.group.subgroupIds.push(groupId)
        
        const version = (this.state.stateVersions.get(parentGroupId) || 0) + 1
        this.state.stateVersions.set(parentGroupId, version)
        
        const change: ChangeMessage = {
          groupId: parentGroupId,
          change: {
            type: 'group-added',
            data: { group: fullGroup }
          },
          version
        }
        this.broadcastChange(change)
        
        const handlers = this.subscriptions.get(parentGroupId)
        if (handlers) {
          handlers.forEach(handler => handler([change.change]))
        }
      }
    } else {
      const result = await this.sendRequestToHost('addGroup', { parentGroupId, group })
      return result.groupId
    }
    
    return groupId
  }
  
  async removeGroup(groupId: string): Promise<void> {
    if (this.state.role === 'host') {
      let parentGroupId: string | null = null
      const groupState = this.state.groupStates.get(groupId)
      if (groupState && groupState.group.parentId) {
        parentGroupId = groupState.group.parentId
      }
      
      this.state.groupStates.delete(groupId)
      this.state.stateVersions.delete(groupId)
      
      if (parentGroupId) {
        const parentState = this.state.groupStates.get(parentGroupId)
        if (parentState && parentState.group.subgroupIds) {
          parentState.group.subgroupIds = parentState.group.subgroupIds.filter(
            id => id !== groupId
          )
          
          const version = (this.state.stateVersions.get(parentGroupId) || 0) + 1
          this.state.stateVersions.set(parentGroupId, version)
          
          const change: ChangeMessage = {
            groupId: parentGroupId,
            change: {
              type: 'group-removed',
              data: { groupId }
            },
            version
          }
          this.broadcastChange(change)
          
          const handlers = this.subscriptions.get(parentGroupId)
          if (handlers) {
            handlers.forEach(handler => handler([change.change]))
          }
        }
      }
    } else {
      await this.sendRequestToHost('removeGroup', { groupId })
    }
  }
  
  async disconnect(wireId: string): Promise<void> {
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
            data: { 
              wireId,
              groupId  // Include groupId in the data
            }
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
    console.log('[WebRTC] Scheduler setting ignored - P2P always uses immediate propagation')
  }
  
  async applyRefactoring(operation: string, params: any): Promise<any> {
    throw new Error('Refactoring not yet implemented for WebRTC')
  }
  
  async schedulePropagation(fromContactId: string, toContactId: string, content: unknown): Promise<void> {
    await this.scheduleUpdate(toContactId, content)
  }
  
  // NetworkClient interface methods
  async request<T>(request: any): Promise<import('@bassline/core').Result<T, import('@bassline/core').NetworkError>> {
    try {
      // For WebRTC, we need to route requests through the appropriate handler
      const result = await this.sendRequestToHost(request.type, request.data || {})
      return { ok: true, value: result }
    } catch (error) {
      return { 
        ok: false, 
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
  
  subscribe(handler: (notification: import('@bassline/core').NetworkNotification) => void): () => void {
    // For NetworkClient interface, we'll subscribe to the root group by default
    return this.subscribeToGroup('root', (changes) => {
      // Convert changes to network notifications
      changes.forEach(change => {
        const notification: import('@bassline/core').NetworkNotification = {
          type: 'changes',
          changes: [change]
        }
        handler(notification)
      })
    })
  }
  
  subscribeToGroup(groupId: string, handler: (changes: Change[]) => void): () => void {
    if (!this.subscriptions.has(groupId)) {
      this.subscriptions.set(groupId, [])
    }
    
    const handlers = this.subscriptions.get(groupId)!
    handlers.push(handler)
    
    return () => {
      const handlers = this.subscriptions.get(groupId)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
        if (handlers.length === 0) {
          this.subscriptions.delete(groupId)
        }
      }
    }
  }
  
  async connect(): Promise<import('@bassline/core').Result<void, import('@bassline/core').NetworkError>> {
    try {
      await this.initialize()
      return { ok: true, value: undefined }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
  
  async disconnect(): Promise<void> {
    this.terminate()
  }
  
  isConnected(): boolean {
    return this.state.connected
  }
  
  getMode(): 'worker' | 'websocket' | 'webrtc' {
    return 'webrtc'
  }

  terminate(): void {
    this.peers.forEach(peer => {
      if (peer.dc) peer.dc.close()
      peer.pc.close()
    })
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