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

### Kernel/Userspace Architecture
The system uses a kernel/userspace separation similar to operating systems:
- **Kernel Bassline**: Stateless, contains driver gadgets and primitives
- **Userspace Basslines**: User-created propagation networks
- **Drivers**: Special gadgets that handle side effects (storage, networking, UI)

## Current Architecture

### Kernel/Userspace Model

```
┌─────────────────────────────────────────────────┐
│           USERSPACE BASSLINES                   │
│  - User-created propagation networks            │
│  - Pure contacts, wires, and gadgets           │
│  - No knowledge of storage or networking       │
└────────────────────┬────────────────────────────┘
                     │ Changes flow through
┌────────────────────▼────────────────────────────┐
│           KERNEL BASSLINE (Stateless)           │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │          DRIVER GADGETS                  │  │
│  │  • Storage Drivers (PostgreSQL, Memory)  │  │
│  │  • Bridge Drivers (WebSocket, UI, CLI)   │  │
│  │  • Compound Drivers (multi-target)       │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │          PRIMITIVE GADGETS               │  │
│  │  • Math (add, multiply, subtract)        │  │
│  │  • String (concat, split)                │  │
│  │  • Logic (and, or, not)                  │  │
│  │  • Control (gate, switch)                │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Everything is a Gadget**: Even infrastructure (storage, networking) are gadgets in kernel space
2. **Kernel is Stateless**: The kernel bassline doesn't persist itself, only routes changes
3. **Orthogonal Concerns**: Storage and networking are independent, pluggable drivers
4. **No Special Cases**: UI is just another driver, same as WebSocket or CLI

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

#### Desired Flow (Kernel/Driver Model)
```typescript
1. Userspace: Contact changes value
   ↓
2. Kernel: Receives change notification
   ↓
3. Kernel: Routes to all relevant drivers
   ├─→ StorageDriver.handleChange(contactId, value)
   ├─→ WebSocketDriver.handleChange(contactId, value)  
   └─→ UIDriver.handleChange(contactId, value)
   ↓
4. Each driver handles according to its purpose
   • Storage persists to database
   • WebSocket broadcasts to peers
   • UI updates display
```

#### Driver Interface Pattern
```typescript
interface Driver {
  // Handle changes from userspace
  handleChange(contactId: string, value: any): void | { backpressure: boolean }
  
  // Handle external input (for bridge drivers)
  handleExternalInput?(input: any): void
  
  // Lifecycle
  initialize?(): Promise<void>
  shutdown?(): Promise<void>
}

// Example: Storage Driver
class PostgreSQLDriver implements Driver {
  handleChange(contactId: string, value: any) {
    // PostgreSQL-specific logic (foreign keys, transactions, etc.)
    // This is where ensureGroupExists belongs - not in runtime!
    this.ensureGroupExists(contactId)
    this.saveContact(contactId, value)
  }
}

// Example: Compound Driver
class CompoundStorageDriver implements Driver {
  constructor(private drivers: Driver[]) {}
  
  handleChange(contactId: string, value: any) {
    // Forward to all sub-drivers
    this.drivers.forEach(d => d.handleChange(contactId, value))
  }
}
```

### Key Components

#### 1. Kernel Bassline (Proposed)
- **Responsibilities**:
  - Route changes between userspace and drivers
  - Provide primitive gadgets for computation
  - Manage driver lifecycle
  - Handle backpressure and flow control

- **Components**:
  - **Storage Drivers**: PostgreSQL, Memory, Filesystem, Compound
  - **Bridge Drivers**: WebSocket, UI, CLI, REST API
  - **Primitives**: Math, String, Logic, Control gadgets

#### 2. Driver Gadgets

**Storage Drivers**:
- Handle persistence of network state
- Each driver manages its own requirements (e.g., PostgreSQL handles foreign keys)
- Can be composed using CompoundDriver pattern

**Bridge Drivers**:
- Connect userspace to external world
- UI Driver: React components ↔ Propagation network
- WebSocket Driver: Remote peers ↔ Propagation network
- CLI Driver: Terminal commands ↔ Propagation network

**Key Insight**: The UI is not special - it's just another bridge driver, same as WebSocket or CLI.

#### 3. Current Implementation Issues

**BasslineNetwork** (`/apps/cli/src/bassline/BasslineNetwork.ts`):
- Currently tries to handle both runtime and networking
- Should be split into runtime + WebSocketDriver

**StorageBackedRuntime** (`/apps/cli/src/runtime/StorageBackedRuntime.ts`):
- Mixes runtime concerns with storage concerns
- `ensureGroupExists` belongs in PostgreSQL driver, not runtime
- Fire-and-forget promises cause silent failures

**PostgreSQL Storage** (`/packages/storage-postgres/src/index.ts`):
- Correctly handles its own requirements
- But integration point (StorageBackedRuntime) is broken

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

### Decision 1: Kernel/Userspace Separation

**Options**:

1. **Traditional Layered Architecture**
   - ✅ Familiar pattern
   - ❌ Tight coupling between layers
   - ❌ Special cases for infrastructure

2. **Everything as Userspace Gadgets**
   - ✅ Conceptually pure
   - ❌ Meta-propagation complexity
   - ❌ Who stores the storage gadget?

3. **Kernel/Userspace Model** ⭐ **CHOSEN**
   - ✅ Clean separation of concerns
   - ✅ Everything is gadgets (even infrastructure)
   - ✅ Avoids meta-propagation issues
   - ✅ Familiar OS metaphor
   - ❌ Requires careful boundary definition

### Decision 2: Error Handling Strategy

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

### Decision 3: Async Operation Management

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

### Decision 4: Storage Architecture

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

### Solution 1: Implement Kernel/Driver Architecture

**Kernel Bassline Structure**:
```typescript
class KernelBassline {
  // Stateless - doesn't persist itself
  private drivers: Map<string, Driver> = new Map()
  private primitives: Map<string, PrimitiveGadget> = new Map()
  
  constructor() {
    // Initialize default drivers
    this.drivers.set('storage', new MemoryDriver())
    this.drivers.set('bridge', new LocalBridge())
  }
  
  // Configure drivers (e.g., for production)
  configureDriver(name: string, driver: Driver) {
    this.drivers.set(name, driver)
  }
  
  // Route changes from userspace to drivers
  handleUserChange(contactId: string, value: any) {
    for (const driver of this.drivers.values()) {
      const result = driver.handleChange(contactId, value)
      if (result?.backpressure) {
        // Handle backpressure
        return { backpressure: true }
      }
    }
  }
  
  // Route external input to userspace
  handleExternalInput(source: string, contactId: string, value: any) {
    this.userRuntime.updateContact(contactId, value)
  }
}
```

**Example Driver Implementations**:

```typescript
// PostgreSQL Driver - handles its own requirements
class PostgreSQLDriver implements Driver {
  private ensuredGroups = new Set<string>()
  
  async handleChange(contactId: string, value: any) {
    // PostgreSQL needs groups to exist first
    await this.ensureGroupExists(contactId)
    await this.saveContact(contactId, value)
  }
  
  private async ensureGroupExists(contactId: string) {
    // This belongs HERE, not in runtime!
    const groupId = this.getGroupId(contactId)
    if (!this.ensuredGroups.has(groupId)) {
      await this.db.query(`
        INSERT INTO groups (id) VALUES ($1)
        ON CONFLICT DO NOTHING
      `, [groupId])
      this.ensuredGroups.add(groupId)
    }
  }
}

// Compound Driver for redundancy
class CompoundDriver implements Driver {
  constructor(private drivers: Driver[]) {}
  
  handleChange(contactId: string, value: any) {
    const results = this.drivers.map(d => d.handleChange(contactId, value))
    // Could wait for all, or just fire-and-forget
    return results.find(r => r?.backpressure)
  }
}

// UI Bridge Driver
class UIBridgeDriver implements Driver {
  handleChange(contactId: string, value: any) {
    // Update React state
    this.setState({ [contactId]: value })
  }
  
  handleExternalInput(action: UIAction) {
    // User clicked button, update contact
    this.kernel.handleExternalInput('ui', action.contactId, action.value)
  }
}
```

### Solution 2: Fix Immediate Storage Issues (Quick Win)

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

3. **Move storage concerns to driver**:
```typescript
// Remove from runtime:
// ❌ this.ensureGroupExists(groupId)

// Add to PostgreSQL driver:
class PostgreSQLDriver {
  async handleChange(contactId: string, value: any) {
    // ✅ Driver handles its own requirements
    await this.ensureGroupExists(contactId)
    await this.saveContact(contactId, value)
  }
}
```

### Solution 3: Configuration Examples

**Development Configuration**:
```typescript
const kernel = new KernelBassline()
kernel.configureDriver('storage', new MemoryDriver())
kernel.configureDriver('bridge', new LocalBridge())
```

**Production Configuration**:
```typescript
const kernel = new KernelBassline()

// Compound storage for cache + persistence
kernel.configureDriver('storage', new CompoundDriver([
  new MemoryCacheDriver(),
  new PostgreSQLDriver({ pool: 20 }),
  new S3BackupDriver({ bucket: 'bassline-backup' })
]))

// Multiple bridges for different interfaces
kernel.configureDriver('bridge', new CompoundDriver([
  new WebSocketBridge({ port: 3003 }),
  new UIBridge(),
  new RESTAPIBridge({ port: 8080 })
]))
```

### Solution 4: Implement Proper Queue System

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

### Solution 5: Add Comprehensive Monitoring

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

### Phase 1: Kernel Architecture (2-3 days)
- [ ] Create KernelBassline class
- [ ] Define Driver interface
- [ ] Implement basic MemoryDriver and LocalBridge
- [ ] Refactor runtime to remove storage concerns

### Phase 2: Driver Implementations (3-5 days)
- [ ] Create PostgreSQLDriver with proper error handling
- [ ] Move `ensureGroupExists` to PostgreSQL driver
- [ ] Implement CompoundDriver for composition
- [ ] Create WebSocketBridge driver
- [ ] Create UIBridge driver

### Phase 3: Migration & Testing (1 week)
- [ ] Migrate existing code to kernel/driver model
- [ ] Fix fire-and-forget promises
- [ ] Add comprehensive integration tests
- [ ] Verify database persistence actually works

### Phase 4: Advanced Features (Future)
- [ ] Implement backpressure handling
- [ ] Add queue-based batching to drivers
- [ ] Create monitoring dashboard
- [ ] Document driver development guide

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

1. **How should primitives be represented in the kernel?**
   - Currently in flux, will revisit later
   - Need to balance between kernel complexity and userspace flexibility

2. **Should drivers be async or sync?**
   - Sync is simpler but may block
   - Async allows better parallelism but adds complexity

3. **How do we handle driver initialization order?**
   - Some drivers may depend on others
   - Need clear lifecycle management

4. **What's the migration path to meta-propagation?**
   - Kernel model works now but may want full meta-propagation later
   - How do we ensure smooth transition?

5. **Should compound drivers wait for all sub-drivers?**
   - Options: Wait for all, wait for first, fire-and-forget
   - Trade-off: Consistency vs Performance

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

## Summary

The kernel/userspace architecture provides:
1. **Clean separation** between propagation logic and infrastructure
2. **Everything as gadgets** - even storage and networking
3. **Orthogonal concerns** - storage and bridges are independent
4. **No special cases** - UI is just another bridge driver
5. **Extensibility** - Easy to add new drivers or compose existing ones

The key insight: By moving infrastructure concerns (like `ensureGroupExists`) into drivers where they belong, we achieve true orthogonality and fix our storage issues.

---

*This is a living document. Last updated: 2025-08-07*