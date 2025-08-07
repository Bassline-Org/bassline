# Storage Architecture for Bassline

## Overview

This document outlines the pluggable storage architecture for Bassline's propagation networks. The storage layer provides persistent state management for running networks, enabling Smalltalk-like image persistence while maintaining flexibility through multiple backend implementations.

## Core Concepts

### Separation of Concerns

1. **Basslines (Manifests)**: Portable blueprints that define network topology, gadgets, and metadata
2. **Storage (Runtime State)**: Actual runtime values of contacts, live group structures, and network state
3. **Registry (Basslines as Data)**: Basslines stored as content within the propagation network itself

### Key Principles

- **Pluggable Backends**: Swap storage implementations without changing application code
- **Granular Operations**: Support both bulk and fine-grained updates for efficiency
- **Federation-Ready**: Enable data replication and distribution across instances
- **Image-Like Persistence**: Save and restore entire network states like Smalltalk images

## Storage Interface

```typescript
interface NetworkStorage {
  // Core Operations
  saveContactContent(networkId: string, groupId: string, contactId: string, content: any): Promise<void>
  loadContactContent(networkId: string, groupId: string, contactId: string): Promise<any>
  
  // Group Operations
  saveGroupState(networkId: string, groupId: string, state: GroupState): Promise<void>
  loadGroupState(networkId: string, groupId: string): Promise<GroupState | null>
  
  // Network Operations
  saveNetworkState(networkId: string, state: NetworkState): Promise<void>
  loadNetworkState(networkId: string): Promise<NetworkState | null>
  listNetworks(): Promise<string[]>
  
  // Query Operations
  queryGroups(networkId: string, filter: {
    attributes?: Record<string, any>
    author?: string
    tags?: string[]
  }): Promise<GroupState[]>
  
  // Versioning
  saveSnapshot(networkId: string, label?: string): Promise<string>
  loadSnapshot(networkId: string, snapshotId: string): Promise<NetworkState>
  listSnapshots(networkId: string): Promise<SnapshotInfo[]>
  
  // Lifecycle
  deleteNetwork(networkId: string): Promise<void>
  deleteGroup(networkId: string, groupId: string): Promise<void>
  exists(networkId: string): Promise<boolean>
  
  // Federation/Replication (optional)
  subscribe?(path: string, callback: (state: GroupState) => void): void
  sync?(remote: NetworkStorage): Promise<void>
}
```

## Storage Backends

### 1. MemoryStorage (Default)
- **Use Case**: Development, testing, current functionality
- **Pros**: Fast, simple, no dependencies
- **Cons**: Ephemeral, limited by RAM
- **Implementation**: In-memory Maps and objects

### 2. PostgresStorage
- **Use Case**: Production deployments, persistent state
- **Pros**: ACID compliance, efficient queries, mature ecosystem
- **Cons**: Requires PostgreSQL server
- **Schema**:
```sql
CREATE TABLE networks (
  id TEXT PRIMARY KEY,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE groups (
  network_id TEXT REFERENCES networks(id) ON DELETE CASCADE,
  group_id TEXT,
  structure JSONB,  -- contacts, wires, subgroups
  attributes JSONB,
  PRIMARY KEY (network_id, group_id)
);

CREATE TABLE contacts (
  network_id TEXT,
  group_id TEXT,
  contact_id TEXT,
  content JSONB,
  blend_mode TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id),
  FOREIGN KEY (network_id, group_id) REFERENCES groups ON DELETE CASCADE
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  network_id TEXT REFERENCES networks(id),
  label TEXT,
  state JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_groups_attributes ON groups USING GIN (attributes);
CREATE INDEX idx_contacts_updated ON contacts(updated_at);
CREATE INDEX idx_snapshots_network ON snapshots(network_id, created_at DESC);
```

### 3. FileSystemStorage
- **Use Case**: Self-hosting, git-friendly storage, offline-first
- **Pros**: Simple deployment, version control compatible, human-readable
- **Cons**: Slower queries, limited concurrent access
- **Structure**:
```
storage/
  networks/
    {network-id}/
      metadata.json
      groups/
        root/
          structure.json      # Group topology
          attributes.json
          contacts/
            {contact-id}.json # Individual contact values
        {group-id}/
          structure.json
          contacts/
      snapshots/
        {timestamp}-{label}.json
```

### 4. RemoteStorage (Future)
- **Use Case**: Federation, distributed networks
- **Pros**: Enables multi-instance coordination
- **Cons**: Network latency, complexity
- **Implementation**: Proxy to another Bassline server via WebSocket/HTTP

## Integration with Schedulers

The storage layer integrates at the scheduler level to control persistence timing:

```typescript
interface SchedulerStorageConfig {
  // When to persist changes
  persistOn: 'immediate' | 'batch' | 'interval' | 'manual'
  
  // For batch/interval modes
  batchSize?: number
  intervalMs?: number
  
  // Auto-snapshot configuration
  snapshotInterval?: number  // ms between auto-snapshots
  maxSnapshots?: number      // Maximum snapshots to retain
}
```

### Scheduler Integration Examples

1. **ImmediateScheduler**: Save after each propagation cycle
2. **BatchScheduler**: Save at end of batch processing
3. **TransactionalScheduler**: Save on commit, rollback on abort

## Data Model Examples

### User Profile Storage
```typescript
// Bassline defines structure
const userProfileBassline: Bassline = {
  name: "@alice",
  attributes: {
    "bassline.type": "user-profile"
  },
  build: {
    topology: {
      contacts: [
        { id: "displayName" },
        { id: "bio" },
        { id: "avatar" }
      ]
    }
  }
}

// Storage holds runtime values
const storedState: StoredState = {
  networkId: "main",
  groupId: "users/@alice",
  contacts: new Map([
    ["displayName", { content: "Alice Smith", blendMode: "accept-last" }],
    ["bio", { content: "Developer from SF", blendMode: "accept-last" }],
    ["avatar", { content: "https://...", blendMode: "accept-last" }]
  ]),
  lastModified: new Date()
}
```

### Bassline Registry Storage
```typescript
// Registry itself is a group in the network
const registryState: GroupState = {
  group: {
    id: "registry",
    contacts: new Map([
      // Each bassline stored as a contact
      ["math-toolkit", { 
        content: mathToolkitBassline,  // The actual bassline manifest
        blendMode: "accept-last" 
      }],
      ["ui-components", { 
        content: uiComponentsBassline,
        blendMode: "accept-last" 
      }]
    ])
  }
}
```

## Migration Strategy

### Phase 1: Interface Definition
1. Define `NetworkStorage` interface in core
2. Create `MemoryStorage` implementation matching current behavior
3. Update existing code to use storage interface

### Phase 2: PostgreSQL Implementation
1. Create `PostgresStorage` package
2. Implement full interface with JSONB storage
3. Add migration tooling for existing data

### Phase 3: FileSystem Implementation  
1. Create `FileSystemStorage` package
2. Implement file-based storage
3. Add import/export utilities

### Phase 4: Federation Support
1. Add replication protocol
2. Implement `RemoteStorage` proxy
3. Enable multi-instance synchronization

## Configuration

```typescript
interface StorageConfig {
  // Storage backend selection
  type: 'memory' | 'postgres' | 'filesystem' | 'remote'
  
  // Backend-specific options
  options: {
    // For PostgreSQL
    connectionString?: string
    poolSize?: number
    
    // For FileSystem
    basePath?: string
    compression?: boolean
    
    // For Remote
    serverUrl?: string
    authToken?: string
  }
  
  // Common options
  cache?: {
    enabled: boolean
    ttl?: number
    maxSize?: number
  }
  
  // Persistence behavior
  persistence?: {
    autoSave: boolean
    saveInterval?: number
    snapshotInterval?: number
  }
}
```

## Benefits

1. **Flexibility**: Switch storage backends based on deployment needs
2. **Scalability**: From in-memory development to distributed production
3. **Portability**: Export from one backend, import to another
4. **Federation**: Enable decentralized network of Bassline instances
5. **Resilience**: Snapshots and versioning for recovery
6. **Performance**: Granular operations for efficient updates

## Future Considerations

1. **Hybrid Storage**: Memory cache + persistent backing
2. **S3 Storage**: Cloud-native blob storage for snapshots
3. **IndexedDB Storage**: Browser-based persistence
4. **IPFS Storage**: Decentralized content-addressed storage
5. **Event Sourcing**: Store changes as events for audit trail