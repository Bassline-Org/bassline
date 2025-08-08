# Bassline CLI Architecture Document

## Table of Contents
1. [System Overview](#system-overview)
2. [Current Architecture](#current-architecture)
3. [Identified Issues](#identified-issues)
4. [Architectural Decisions](#architectural-decisions)
5. [Proposed Solutions](#proposed-solutions)
6. [Implementation Roadmap](#implementation-roadmap)

## System Overview

Bassline CLI is a distributed propagation network implementation that supports:
- **Distributed topology management** via Bassline specifications
- **Content propagation** across network nodes
- **Persistent storage** with multiple backend options
- **Peer-to-peer communication** via WebSocket and gossip protocols
- **Hierarchical group management** with ownership and routing

### Core Concepts
- **Bassline**: Network topology specification (groups, contacts, wires)
- **Groups**: Logical partitions of the network that nodes can "run"
- **Contacts**: Data points that hold and propagate content
- **Wires**: Connections between contacts for data flow
- **Gossip**: Peer-to-peer protocol for content synchronization

## Current Architecture

### Layer Structure

```
┌─────────────────────────────────────┐
│     BasslineNetwork (Top Layer)     │
│  - Distributed network management   │
│  - Peer communication & gossip      │
│  - Group ownership & routing        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  StorageBackedRuntime (Middle)      │
│  - Extends NetworkRuntime           │
│  - Persistence coordination         │
│  - Content hashing & dirty tracking │
│  - Promise/operation queue          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   NetworkStorage Interface (Base)   │
│  - Abstract storage operations      │
│  - Result<T, Error> pattern        │
│  - Multiple implementations:        │
│    • PostgreSQL (primary)          │
│    • Memory (testing)              │
│    • Filesystem (experimental)     │
└─────────────────────────────────────┘
```

### Data Flow

#### Update Flow (Current - Problematic)
```typescript
1. BasslineNetwork.updateContact(contactId, content)
   ↓
2. StorageBackedRuntime.scheduleUpdate(contactId, content)
   ↓
3. Creates promise: ensureGroupExists().then(() => saveContactContent())
   ↓
4. Promise pushed to pendingOperations[]
   ↓
5. Promise executes asynchronously (fire-and-forget)
   ↓
6. Result may succeed or fail silently
```

#### Storage Interface Pattern
```typescript
interface NetworkStorage {
  saveContactContent(...): Promise<Result<void, StorageError>>
  loadContactContent(...): Promise<Result<T | null, StorageError>>
  // All methods return Result<T, Error> - never throw
}
```

### Key Components

#### 1. BasslineNetwork (`/apps/cli/src/bassline/BasslineNetwork.ts`)
- **Responsibilities**:
  - Manage network topology from Bassline spec
  - Handle peer connections and gossip protocol
  - Route updates to appropriate groups
  - Track ownership and content distribution

- **Key Methods**:
  - `joinNetwork(bassline, groups)` - Initialize node with topology
  - `updateContact(contactId, content)` - Propagate content updates
  - `connectToPeer(endpoint)` - Establish peer connections
  - `handleGossip(peerId, contacts)` - Process incoming gossip

#### 2. StorageBackedRuntime (`/apps/cli/src/runtime/StorageBackedRuntime.ts`)
- **Responsibilities**:
  - Bridge between network operations and storage
  - Manage pending storage operations
  - Track content hashes for deduplication
  - Handle dirty state and deferred saves

- **Key State**:
  - `pendingOperations: Promise<any>[]` - Queue of storage operations
  - `ensuredGroups: Set<string>` - Cache of initialized groups
  - `contentHashes: Map<string, string>` - Content deduplication
  - `isDirty: boolean` - Tracks unsaved changes

#### 3. PostgreSQL Storage (`/packages/storage-postgres/src/index.ts`)
- **Responsibilities**:
  - Implement NetworkStorage interface for PostgreSQL
  - Manage connection pooling
  - Handle transactions and error recovery
  - Enforce foreign key constraints

- **Database Schema**:
  ```sql
  bassline_networks (id, name, description, attributes)
  bassline_groups (network_id, group_id, name, type, ...)
  bassline_contacts (network_id, group_id, contact_id, content, ...)
  bassline_wires (network_id, from_contact_id, to_contact_id, ...)
  ```

## Identified Issues

### 1. Silent Storage Failures ⚠️ **CRITICAL**

**Symptom**: Database shows 0 contacts despite thousands of "successful" operations

**Root Causes**:
1. **Fire-and-forget promises**: Operations added to `pendingOperations[]` but not properly awaited
2. **Broken promise chains**: Errors in `ensureGroupExists()` break subsequent `saveContactContent()`
3. **No error propagation**: Storage errors returned as `Result` but not checked
4. **Race conditions**: Multiple parallel operations trying to create same group

**Evidence**:
```typescript
// Current problematic code:
const savePromise = this.ensureGroupExists(contact.groupId).then(async () => {
  if (this.storage && this.storage.saveContactContent) {
    const result = await this.storage.saveContactContent(...)
    // Result not checked! Could be { ok: false, error: ... }
  }
}).catch(err => {
  console.error(err) // Logged but not propagated
  throw err          // Re-thrown but nobody catches it
})
this.pendingOperations.push(savePromise) // Added but may already be rejected
```

### 2. Async/Promise Anti-Patterns

**Issues**:
- Mixing async/await with .then()/.catch()
- Creating promises without proper error boundaries
- Not awaiting critical operations
- Using arrays to track promises instead of proper queues

**Impact**:
- Unpredictable execution order
- Lost error context
- Memory leaks from unresolved promises
- Difficult debugging and testing

### 3. Result<T, E> vs Exception Mismatch

**Problem**: Two different error handling paradigms in same codebase

**Storage Layer** (Functional):
```typescript
async saveContactContent(...): Promise<Result<void, StorageError>> {
  try {
    // ... operation ...
    return { ok: true, value: undefined }
  } catch (error) {
    return { ok: false, error: {...} }  // Never throws
  }
}
```

**Runtime Layer** (Imperative):
```typescript
if (!result.ok) {
  throw new StorageError(...)  // Expects exceptions
}
```

**Consequences**:
- Confusion about error handling strategy
- Errors caught at wrong boundaries
- Silent failures when Result.error not checked

### 4. Database Transaction Issues

**Problems**:
- No transaction boundaries for related operations
- Foreign key violations from out-of-order operations
- Race conditions in parallel updates
- No retry logic for transient failures

### 5. Performance & Scalability Issues

**Bottlenecks**:
- Every update triggers `ensureGroupExists()` (even if already ensured)
- No batching of database operations
- No connection pool tuning
- Synchronous hashing on main thread

## Architectural Decisions

### Decision 1: Error Handling Strategy

**Options**:

1. **Pure Functional (Result everywhere)**
   - ✅ Explicit error handling
   - ✅ Type-safe error paths
   - ❌ Verbose, requires checking everywhere
   - ❌ Not idiomatic JavaScript/TypeScript

2. **Pure Imperative (Exceptions everywhere)**
   - ✅ Idiomatic JavaScript
   - ✅ Simple error propagation
   - ❌ Hidden control flow
   - ❌ Harder to handle specific errors

3. **Hybrid (Result at boundaries, exceptions internally)** ⭐ **RECOMMENDED**
   - ✅ Clear boundaries
   - ✅ Type safety where it matters
   - ✅ Idiomatic internally
   - ❌ Requires clear documentation

### Decision 2: Async Operation Management

**Options**:

1. **Synchronous Operations (await everything)**
   - ✅ Simple, predictable
   - ✅ Easy error handling
   - ❌ Slower for bulk operations
   - ❌ No parallelism

2. **Queue-Based Processing** ⭐ **RECOMMENDED**
   - ✅ Batching capability
   - ✅ Controlled parallelism
   - ✅ Retry logic
   - ❌ More complex implementation

3. **Event-Driven Architecture**
   - ✅ Decoupled components
   - ✅ Scalable
   - ❌ Complex debugging
   - ❌ Potential message loss

### Decision 3: Storage Architecture

**Options**:

1. **Direct Storage Calls**
   - ✅ Simple
   - ❌ No optimization opportunity
   - ❌ Tight coupling

2. **Write-Through Cache with Queue** ⭐ **RECOMMENDED**
   - ✅ Fast reads
   - ✅ Batched writes
   - ✅ Resilience to storage failures
   - ❌ Cache invalidation complexity

3. **Event Sourcing**
   - ✅ Complete audit trail
   - ✅ Time travel debugging
   - ❌ Complex implementation
   - ❌ Storage overhead

## Proposed Solutions

### Solution 1: Fix Immediate Storage Issues (Quick Win)

**Changes Required**:

1. **Make updateContact fully async**:
```typescript
// BasslineNetwork
async updateContact(contactId: string, content: any): Promise<void> {
  // ... validation ...
  await this.runtime.scheduleUpdate(contactId, content)
  // Don't return until storage confirms
}
```

2. **Fix ensureGroupExists**:
```typescript
private groupEnsurePromises = new Map<string, Promise<void>>()

private async ensureGroupExists(groupId: string): Promise<void> {
  // Dedup parallel calls for same group
  if (this.groupEnsurePromises.has(groupId)) {
    return this.groupEnsurePromises.get(groupId)!
  }
  
  const promise = this.doEnsureGroup(groupId)
  this.groupEnsurePromises.set(groupId, promise)
  
  try {
    await promise
  } finally {
    this.groupEnsurePromises.delete(groupId)
  }
}
```

3. **Check storage results**:
```typescript
const result = await this.storage.saveContactContent(...)
if (!result.ok) {
  throw new DatabaseError(
    `Failed to save contact: ${result.error.message}`,
    result.error
  )
}
```

### Solution 2: Implement Proper Queue System

**New Component: StorageQueue**:

```typescript
class StorageQueue {
  private queue: WriteOperation[] = []
  private processing = false
  private batchSize = 100
  private flushInterval = 100 // ms
  
  add(operation: WriteOperation): void {
    this.queue.push(operation)
    this.scheduleFlush()
  }
  
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    const batch = this.queue.splice(0, this.batchSize)
    
    try {
      await this.processBatch(batch)
    } catch (error) {
      // Retry logic
      this.handleBatchError(batch, error)
    } finally {
      this.processing = false
      if (this.queue.length > 0) {
        this.scheduleFlush()
      }
    }
  }
  
  private async processBatch(operations: WriteOperation[]): Promise<void> {
    // Group by type for optimal ordering
    const grouped = this.groupOperations(operations)
    
    // Execute in order: networks -> groups -> contacts
    await this.storage.transaction(async (tx) => {
      await this.processNetworks(tx, grouped.networks)
      await this.processGroups(tx, grouped.groups)
      await this.processContacts(tx, grouped.contacts)
    })
  }
}
```

### Solution 3: Add Comprehensive Monitoring

**Metrics to Track**:
- Storage operation latency (p50, p95, p99)
- Queue depth over time
- Error rates by operation type
- Database connection pool utilization
- Cache hit/miss rates

**Implementation**:
```typescript
class StorageMetrics {
  private histogram = new Histogram()
  
  async trackOperation<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await operation()
      this.recordSuccess(name, performance.now() - start)
      return result
    } catch (error) {
      this.recordError(name, error)
      throw error
    }
  }
}
```

## Implementation Roadmap

### Phase 1: Critical Fixes (1-2 days)
- [ ] Fix fire-and-forget promises in StorageBackedRuntime
- [ ] Add proper error checking for storage Results
- [ ] Implement group deduplication to prevent race conditions
- [ ] Add integration test to verify persistence

### Phase 2: Queue Implementation (3-5 days)
- [ ] Design WriteOperation types
- [ ] Implement StorageQueue with batching
- [ ] Add retry logic with exponential backoff
- [ ] Create queue metrics and monitoring

### Phase 3: Performance Optimization (1 week)
- [ ] Implement write-through cache
- [ ] Add database connection pooling optimization
- [ ] Move hashing to worker thread
- [ ] Add database indexes for common queries

### Phase 4: Testing & Documentation (Ongoing)
- [ ] Create comprehensive integration tests
- [ ] Add performance benchmarks
- [ ] Document error handling patterns
- [ ] Create troubleshooting guide

## Testing Strategy

### Unit Tests
- Test each component in isolation
- Mock storage interfaces
- Test error conditions

### Integration Tests
```typescript
describe('Storage Integration', () => {
  it('should persist data to database', async () => {
    const node = new BasslineNetwork({ storage: postgres })
    await node.updateContact('c1', { value: 42 })
    
    // Verify in database
    const result = await db.query('SELECT * FROM bassline_contacts')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].content).toEqual({ value: 42 })
  })
})
```

### Stress Tests
- 1000+ parallel updates
- Network partitions
- Storage failures
- Memory pressure

## Open Questions

1. **Should we use transactions for all operations or just batches?**
   - Trade-off: Consistency vs Performance

2. **How should we handle storage migration when schema changes?**
   - Options: Versioned migrations, backward compatibility, blue-green deployment

3. **Should we implement circuit breakers for storage failures?**
   - Prevents cascade failures but adds complexity

4. **What's the right balance between memory cache and database hits?**
   - Trade-off: Memory usage vs Latency

5. **Should we support multiple storage backends simultaneously?**
   - Use case: Migration, redundancy, different storage for different data types

## Appendix

### Current File Structure
```
apps/cli/
├── src/
│   ├── bassline/
│   │   ├── BasslineNetwork.ts    # Main network implementation
│   │   ├── BasslineGossip.ts     # Gossip protocol
│   │   └── types.ts               # Type definitions
│   ├── runtime/
│   │   ├── NetworkRuntime.ts     # Base runtime
│   │   └── StorageBackedRuntime.ts # Storage integration
│   └── __tests__/
│       └── database-verification.test.ts # Persistence tests

packages/
├── core/
│   └── src/
│       ├── storage/
│       │   └── interface.ts      # Storage contracts
│       └── errors.ts              # Error classes
└── storage-postgres/
    └── src/
        └── index.ts               # PostgreSQL implementation
```

### Related Documents
- [CLAUDE.md](../../../CLAUDE.md) - Project overview and concepts
- [README.md](../README.md) - CLI usage documentation
- [PRODUCTION_READY.md](../../packages/storage-postgres/PRODUCTION_READY.md) - PostgreSQL storage details

---

*This is a living document. Last updated: 2025-01-08*