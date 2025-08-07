/**
 * Bassline Network Types
 * 
 * A Bassline defines the complete topology and truth of a propagation network.
 * All participants agree on the same Bassline, but each runs different parts.
 */

import type { 
  ContactId, 
  GroupId, 
  WireId,
  PrimitiveGadget,
  BlendMode,
  WireType
} from '@bassline/core'

/**
 * A Bassline is the source of truth for a propagation network
 */
export interface Bassline {
  id: string
  version: string
  
  // The canonical topology - what should exist
  topology: BasslineTopology
  
  // Where groups are hosted
  endpoints: Map<GroupId, Endpoint>
  
  // References to sub-Basslines (groups that are themselves networks)
  subBasslines: Map<GroupId, BasslineReference>
  
  // Metadata
  metadata: BasslineMetadata
}

export interface BasslineTopology {
  groups: Map<GroupId, GroupSpec>
  contacts: Map<ContactId, ContactSpec>
  wires: Map<WireId, WireSpec>
}

export interface GroupSpec {
  id: GroupId
  name: string
  parentId?: GroupId
  
  // Boundary interface - how to interact with this group
  inputs: ContactId[]
  outputs: ContactId[]
  
  // Implementation
  primitive?: PrimitiveGadget  // This group is a primitive gadget
  bassline?: BasslineReference  // This group IS another Bassline network
  
  // Ownership and replication
  primary?: Endpoint     // Primary owner
  replicas?: Endpoint[]  // For redundancy
}

export interface ContactSpec {
  id: ContactId
  groupId: GroupId
  name?: string
  blendMode: BlendMode
  
  // Boundary information
  isBoundary?: boolean
  boundaryDirection?: 'input' | 'output'
  
  // Expected content type/schema (optional)
  schema?: any
}

export interface WireSpec {
  id: WireId
  fromId: ContactId
  toId: ContactId
  type: WireType
  groupId?: GroupId
  
  // Wire metadata
  priority?: number  // For sync prioritization
  required?: boolean // Must be maintained for network validity
}

export interface Endpoint {
  url: string        // ws://host:port
  peerId: string     // Unique peer identifier
  publicKey?: string // For authentication
  
  // Capabilities this endpoint provides
  capabilities?: string[]
  
  // Network location hints
  region?: string
  latency?: number
}

export interface BasslineReference {
  url: string     // Where to get this Bassline
  hash: string    // Content hash for verification
  version: string // Version compatibility
  
  // Where it's currently running
  endpoints?: Endpoint[]
}

export interface BasslineMetadata {
  created: Date
  modified: Date
  author: string
  description?: string
  
  // For trust and verification
  signature?: string
  signedBy?: string
  
  // Network governance
  admins?: string[]
  updatePolicy?: 'anyone' | 'admins' | 'consensus'
}

/**
 * Runtime state for a Bassline network participant
 */
export interface BasslineNode {
  // The agreed-upon Bassline
  bassline: Bassline
  
  // Which groups this node is responsible for
  localGroups: Set<GroupId>
  
  // Current content (only for owned contacts)
  localContent: Map<ContactId, any>
  
  // Who owns what (discovered via gossip)
  ownership: Map<ContactId, Set<string>>
  
  // Connected peers
  peers: Map<string, BasslinePeer>
  
  // Sub-networks this node is running
  subNetworks: Map<GroupId, BasslineNode>
}

export interface BasslinePeer {
  id: string
  endpoint: Endpoint
  connection?: WebSocket
  
  // What this peer owns
  ownedGroups: Set<GroupId>
  ownedContacts: Set<ContactId>
  
  // Network quality
  latency: number
  lastSeen: number
  reliability: number
  
  // For wire-aware routing
  wireAffinity: number  // How many wires connect us
}

/**
 * Commands for Bassline gossip protocol
 */
export type BasslineCommand = 
  | { type: 'bassline-announce'; bassline: Bassline }
  | { type: 'bassline-hash'; hash: string; version: string }
  | { type: 'group-ownership'; groups: GroupId[]; contacts: ContactId[] }
  | { type: 'content-update'; contactId: ContactId; content: any; hash: string }
  | { type: 'wire-sync'; wireId: WireId; fromContent: any; toContent: any }
  | { type: 'partition-detected'; brokenWires: WireId[] }
  | { type: 'partition-healed'; healedWires: WireId[] }
  | { type: 'sub-bassline-announce'; groupId: GroupId; bassline: BasslineReference }
  | { type: 'sync-request'; contacts: ContactId[] }
  | { type: 'sync-response'; updates: Map<ContactId, any> }

/**
 * Events emitted by Bassline network
 */
export type BasslineEvent =
  | { type: 'bassline.loaded'; bassline: Bassline }
  | { type: 'peer.connected'; peer: BasslinePeer }
  | { type: 'peer.disconnected'; peerId: string }
  | { type: 'content.updated'; contactId: ContactId; content: any }
  | { type: 'wire.broken'; wireId: WireId }
  | { type: 'wire.healed'; wireId: WireId }
  | { type: 'partition.detected'; peers: string[] }
  | { type: 'partition.healed'; bridgeNode: string }
  | { type: 'sub-bassline.started'; groupId: GroupId }
  | { type: 'convergence.achieved'; coverage: number }

/**
 * Configuration for joining a Bassline network
 */
export interface BasslineConfig {
  // Network identity
  peerId: string
  endpoint: Endpoint
  
  // What to run
  groupsToRun?: GroupId[]  // Specific groups
  autoSelectGroups?: boolean  // Automatically pick underserved groups
  
  // Storage
  storage?: any  // Storage backend
  
  // Network behavior
  syncInterval?: number
  heartbeatInterval?: number
  partitionCheckInterval?: number
  
  // Limits
  maxPeers?: number
  maxSubNetworks?: number
  maxContentSize?: number
}