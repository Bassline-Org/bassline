/**
 * Network Communication Types
 * 
 * Strong domain modeling for network communication between
 * main thread and worker, or between client and server
 */

import type { 
  Group, 
  Contact, 
  Wire, 
  GroupState, 
  Change,
  ContactId,
  GroupId,
  WireId,
  Result
} from './types'

// ============================================================================
// Network Mode Types
// ============================================================================

export type NetworkMode = 'worker' | 'websocket' | 'webrtc' | 'remote'

export interface NetworkConfig {
  mode: NetworkMode
  url?: string  // For websocket/remote modes
  roomId?: string  // For WebRTC mode
  peerId?: string  // For WebRTC mode
}

// ============================================================================
// Request/Response Pattern
// ============================================================================

// Request types - strongly typed by operation
export type NetworkRequest = 
  | RegisterGroupRequest
  | ScheduleUpdateRequest
  | SchedulePropagationRequest
  | ConnectRequest
  | DisconnectRequest
  | AddContactRequest
  | RemoveContactRequest
  | AddGroupRequest
  | RemoveGroupRequest
  | GetStateRequest
  | GetContactRequest
  | GetWireRequest
  | SetSchedulerRequest
  | ImportStateRequest
  | ExportStateRequest

// Individual request types
export interface RegisterGroupRequest {
  type: 'registerGroup'
  id: string
  data: Group
}

export interface ScheduleUpdateRequest {
  type: 'scheduleUpdate'
  id: string
  data: {
    contactId: ContactId
    content: unknown
  }
}

export interface SchedulePropagationRequest {
  type: 'schedulePropagation'
  id: string
  data: {
    fromContactId: ContactId
    toContactId: ContactId
    content: unknown
  }
}

export interface ConnectRequest {
  type: 'connect'
  id: string
  data: {
    fromId: ContactId
    toId: ContactId
    wireType?: 'bidirectional' | 'directed'
  }
}

export interface DisconnectRequest {
  type: 'disconnect'
  id: string
  data: {
    wireId: WireId
  }
}

export interface AddContactRequest {
  type: 'addContact'
  id: string
  data: {
    groupId: GroupId
    contact: Omit<Contact, 'id'>
  }
}

export interface RemoveContactRequest {
  type: 'removeContact'
  id: string
  data: {
    contactId: ContactId
  }
}

export interface AddGroupRequest {
  type: 'addGroup'
  id: string
  data: {
    parentGroupId: GroupId
    group: Omit<Group, 'id' | 'parentId' | 'contactIds' | 'wireIds' | 'subgroupIds' | 'boundaryContactIds'>
  }
}

export interface RemoveGroupRequest {
  type: 'removeGroup'
  id: string
  data: {
    groupId: GroupId
  }
}

export interface GetStateRequest {
  type: 'getState'
  id: string
  data: {
    groupId: GroupId
  }
}

export interface GetContactRequest {
  type: 'getContact'
  id: string
  data: {
    contactId: ContactId
  }
}

export interface GetWireRequest {
  type: 'getWire'
  id: string
  data: {
    wireId: WireId
  }
}

export interface SetSchedulerRequest {
  type: 'setScheduler'
  id: string
  data: {
    scheduler: 'immediate' | 'batch' | 'animation-frame' | 'priority'
  }
}

export interface ImportStateRequest {
  type: 'importState'
  id: string
  data: {
    state: any  // NetworkState
  }
}

export interface ExportStateRequest {
  type: 'exportState'
  id: string
  data?: undefined
}

// Response type - success or error
export interface NetworkResponse<T = any> {
  id: string
  result: Result<T, NetworkError>
}

export interface NetworkError {
  code: NetworkErrorCode
  message: string
  details?: unknown
}

export type NetworkErrorCode = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR'
  | 'SCHEDULER_ERROR'

// ============================================================================
// Notification Pattern (Push from worker/server)
// ============================================================================

export type NetworkNotification = 
  | ChangesNotification
  | ReadyNotification
  | ErrorNotification
  | StateChangedNotification
  | PeerConnectedNotification
  | PeerDisconnectedNotification

export interface ChangesNotification {
  type: 'changes'
  changes: Change[]
}

export interface ReadyNotification {
  type: 'ready'
  version?: string
}

export interface ErrorNotification {
  type: 'error'
  error: NetworkError
}

export interface StateChangedNotification {
  type: 'stateChanged'
  groupId: GroupId
  state: GroupState
}

export interface PeerConnectedNotification {
  type: 'peerConnected'
  peerId: string
  peerInfo?: {
    name?: string
    avatar?: string
  }
}

export interface PeerDisconnectedNotification {
  type: 'peerDisconnected'
  peerId: string
}

// ============================================================================
// Network Client Interface
// ============================================================================

export interface NetworkClient {
  // Send a request and wait for response
  request<T>(request: NetworkRequest): Promise<Result<T, NetworkError>>
  
  // Subscribe to notifications
  subscribe(handler: (notification: NetworkNotification) => void): () => void
  
  // Connection management
  connect(): Promise<Result<void, NetworkError>>
  disconnect(): Promise<void>
  isConnected(): boolean
  
  // Get current mode
  getMode(): NetworkMode
}

// ============================================================================
// Message Protocol
// ============================================================================

export type NetworkMessage = NetworkRequest | NetworkResponse | NetworkNotification

// Helper to identify message type
export function isRequest(msg: NetworkMessage): msg is NetworkRequest {
  return 'type' in msg && 'id' in msg && 'data' in msg
}

export function isResponse(msg: NetworkMessage): msg is NetworkResponse {
  return 'id' in msg && 'result' in msg
}

export function isNotification(msg: NetworkMessage): msg is NetworkNotification {
  return 'type' in msg && !('id' in msg)
}

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ConnectionStatus {
  state: ConnectionState
  error?: NetworkError
  lastConnected?: Date
  reconnectAttempts?: number
}