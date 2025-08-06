import type { Change, GroupState } from '~/propagation-core-v2/types'

// WebRTC message types
export type P2PMessageType = 
  | 'state-sync'      // Full state synchronization
  | 'change'          // Incremental change
  | 'request'         // Request/response pattern
  | 'response'        // Response to request
  | 'heartbeat'       // Keep-alive
  | 'state-request'   // Request for state
  | 'role-announce'   // Announce host/guest role

export interface P2PMessage {
  id: string
  timestamp: number
  from: string
  type: P2PMessageType
  payload: any
}

export interface StateSync {
  groupId: string
  state: any
  version: number
}

export interface ChangeMessage {
  groupId: string
  change: Change
  version: number
}

export interface RequestMessage {
  method: string
  params: any
}

export interface ResponseMessage {
  requestId: string
  data?: any
  error?: string
}

// Room management
export interface RoomInfo {
  roomCode: string
  hostId: string
  guestIds: string[]
  createdAt: number
}

export interface PeerInfo {
  id: string
  role: 'host' | 'guest'
  connected: boolean
  lastSeen: number
}

// Signaling messages
export type SignalingMessageType = 
  | 'create-room'
  | 'join-room'
  | 'leave-room'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'room-created'
  | 'room-joined'
  | 'peer-joined'
  | 'peer-left'
  | 'error'

export interface SignalingMessage {
  type: SignalingMessageType
  roomCode?: string
  peerId?: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  error?: string
  data?: any
}

// WebRTC configuration
export interface WebRTCConfig {
  iceServers: RTCIceServer[]
  signalingUrl: string
  roomCode?: string
  isHost?: boolean
}

// Network state management
export interface P2PNetworkState {
  localPeerId: string
  peers: Map<string, PeerInfo>
  role: 'host' | 'guest'
  roomCode: string
  connected: boolean
  groupStates: Map<string, any>
  stateVersions: Map<string, number>
}