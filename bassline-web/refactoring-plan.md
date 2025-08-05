# Bassline Refactoring Plan

## Current State Assessment

### What We Have
After the major refactor to eliminate manual `syncToReactFlow()` calls and implement immutable state management:

1. **Clean React Architecture**
   - Immutable state management in `NetworkState.tsx`
   - No more manual sync operations
   - Proper React patterns throughout
   - All UI features working (selection, creation, deletion, movement, etc.)

2. **Lost Functionality**
   - **No real propagation engine** - just simple value copying
   - **No blend modes** - merge/accept-last not implemented
   - **No contradiction detection**
   - **No bidirectional constraint solving**
   - The core PropagationNetwork class exists but is completely disconnected

### The Problem
We successfully refactored for clean React patterns but lost the core propagation functionality that makes this system unique. We're essentially building a generic node editor, not a propagation network system.

## New Architecture Decision: Stream-Based Worker Thread

After discussing various approaches, we've decided on a radical simplification:

### The Stream Architecture
1. **PropagationNetwork runs in a Worker thread** - Complete separation from UI
2. **React Router handles all data flow** - Loaders fetch, actions mutate
3. **Stream notifications trigger revalidation** - Worker tells React Router when to refetch
4. **No global state management** - Just React Router's loader data

### Benefits
- **Clean separation** - PropagationNetwork doesn't know about React
- **Single source of truth** - Network in Worker is authoritative
- **React Router native** - Works perfectly with loaders/actions
- **Future-proof** - Could become a real server later
- **Performance** - Propagation runs off main thread

## Implementation Plan

### Phase 1: Analyze & Clean PropagationCore (Current)

#### Current OOP Structure Issues
1. **Mutable state** - Classes with private fields and setters
2. **Synchronous propagation** - No async support
3. **Circular references** - Contacts reference groups, groups reference contacts
4. **Tight coupling** - Contact.propagate() directly calls group methods
5. **No event system** - Changes happen silently

#### Proposed Functional/Async Design with Scheduler

**Core Types (Pure Data)**
```typescript
interface Contact {
  id: string
  groupId: string
  position: Position
  content?: unknown
  blendMode: 'accept-last' | 'merge'
  isBoundary?: boolean
  boundaryDirection?: 'input' | 'output'
  lastContradiction?: Contradiction
}

interface Wire {
  id: string
  fromId: string
  toId: string
  type: 'bidirectional' | 'directed'
}

interface Group {
  id: string
  name: string
  parentId?: string
  contactIds: string[]
  wireIds: string[]
  subgroupIds: string[]
  boundaryContactIds: string[]
  // New: group can be local or remote
  location?: 'local' | { type: 'remote', url: string }
}

interface PropagationTask {
  id: string
  groupId: string
  contactId: string
  content: unknown
  priority?: number
  timestamp: number
}
```

**PropagationNetworkScheduler - The Core Abstraction**
```typescript
interface PropagationNetworkScheduler {
  // Register a group (local or remote)
  registerGroup: (group: Group) => Promise<void>
  
  // Schedule a content update
  scheduleUpdate: (contactId: string, content: unknown) => Promise<void>
  
  // Schedule a propagation from a contact
  schedulePropagation: (fromContactId: string, toContactId: string, content: unknown) => Promise<void>
  
  // Get current state (for queries)
  getState: (groupId: string) => Promise<GroupState>
  
  // Subscribe to changes
  subscribe: (callback: (changes: Change[]) => void) => () => void
}

// Scheduler factory functions
function createImmediateScheduler(): PropagationNetworkScheduler {
  const taskQueue: PropagationTask[] = []
  const groups = new Map<string, GroupState>()
  const subscribers = new Set<(changes: Change[]) => void>()
  
  const processQueue = async () => {
    while (taskQueue.length > 0) {
      const task = taskQueue.shift()!
      const changes = await processTask(groups, task)
      subscribers.forEach(sub => sub(changes))
    }
  }
  
  return {
    async registerGroup(group) {
      groups.set(group.id, { 
        group, 
        contacts: new Map(),
        wires: new Map() 
      })
    },
    
    async scheduleUpdate(contactId, content) {
      taskQueue.push({
        id: crypto.randomUUID(),
        groupId: findGroupForContact(groups, contactId),
        contactId,
        content,
        timestamp: Date.now()
      })
      await processQueue()
    },
    
    async schedulePropagation(fromId, toId, content) {
      // Add propagation task
      taskQueue.push({
        id: crypto.randomUUID(),
        groupId: findGroupForContact(groups, toId),
        contactId: toId,
        content,
        timestamp: Date.now()
      })
      await processQueue()
    },
    
    async getState(groupId) {
      return groups.get(groupId) || createEmptyGroupState(groupId)
    },
    
    subscribe(callback) {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }
  }
}

function createBatchScheduler(batchSize = 10, delay = 16): PropagationNetworkScheduler {
  const scheduler = createImmediateScheduler()
  let batchTimeout: NodeJS.Timeout | null = null
  let pendingTasks: PropagationTask[] = []
  
  // Override scheduleUpdate to batch
  const originalSchedule = scheduler.scheduleUpdate
  scheduler.scheduleUpdate = async (contactId, content) => {
    pendingTasks.push({ contactId, content })
    
    if (!batchTimeout) {
      batchTimeout = setTimeout(async () => {
        const batch = pendingTasks.splice(0, batchSize)
        for (const task of batch) {
          await originalSchedule(task.contactId, task.content)
        }
        batchTimeout = null
      }, delay)
    }
  }
  
  return scheduler
}

function createDistributedScheduler(
  localScheduler = createImmediateScheduler()
): PropagationNetworkScheduler {
  const remoteGroups = new Map<string, RemoteGroupProxy>()
  
  return {
    ...localScheduler,
    
    async registerGroup(group) {
      if (group.location === 'local' || !group.location) {
        await localScheduler.registerGroup(group)
      } else {
        // Register remote proxy
        remoteGroups.set(group.id, createRemoteProxy(group.location.url))
      }
    },
    
    async scheduleUpdate(contactId, content) {
      const groupId = await findGroupForContact(contactId)
      const remoteProxy = remoteGroups.get(groupId)
      
      if (remoteProxy) {
        await remoteProxy.scheduleUpdate(contactId, content)
      } else {
        await localScheduler.scheduleUpdate(contactId, content)
      }
    }
  }
}
```

**Async Propagation Functions**
```typescript
// Pure function that calculates propagation changes
async function propagateContent(
  state: NetworkState,
  sourceContactId: string,
  newContent: unknown
): Promise<PropagationResult> {
  const changes: ContactUpdate[] = []
  const queue: PropagationTask[] = [{ contactId: sourceContactId, content: newContent }]
  const visited = new Set<string>()
  
  while (queue.length > 0) {
    const task = queue.shift()!
    if (visited.has(task.contactId)) continue
    visited.add(task.contactId)
    
    const contact = state.contacts.get(task.contactId)
    if (!contact) continue
    
    // Calculate new content based on blend mode
    const result = await applyBlendMode(contact, task.content)
    if (result.changed) {
      changes.push({ contactId: task.contactId, updates: result.updates })
      
      // Queue connected contacts
      const connections = getConnectedContacts(state, task.contactId)
      for (const nextId of connections) {
        queue.push({ contactId: nextId, content: result.content })
      }
    }
  }
  
  return { changes, contradictions: [] }
}

// Async blend mode application
async function applyBlendMode(
  contact: Contact,
  newContent: unknown
): Promise<BlendResult> {
  if (contact.blendMode === 'merge' && contact.content !== undefined) {
    // Could be async for complex merges
    return await mergeContent(contact.content, newContent)
  }
  return { 
    changed: contact.content !== newContent,
    content: newContent,
    updates: { content: newContent }
  }
}
```

**Benefits of Scheduler-Based Architecture**
1. **Pluggable Strategies** - Can swap schedulers for different behaviors
   - ImmediateScheduler for simple demos
   - BatchScheduler for performance
   - DistributedScheduler for scaling
   
2. **Distribution-Ready** - Groups can run anywhere
   - Local groups in same process
   - Remote groups over WebSocket/HTTP
   - Mix of local and remote in same network
   
3. **Testable** - Can mock scheduler for testing
   - Test propagation logic separately
   - Test scheduling strategies separately
   - Easy to simulate network delays
   
4. **Observable** - All changes go through scheduler
   - Can log all propagations
   - Can visualize propagation waves
   - Can measure performance
   
5. **Flexible Execution** - Different strategies for different needs
   - Immediate for responsiveness
   - Batch for efficiency
   - Priority for important updates first

**Benefits of Functional/Async Approach**
1. **Immutable data** - Easier to reason about
2. **Async propagation** - Ready for distributed/parallel execution
3. **Pure functions** - Testable, predictable
4. **Event-driven** - Natural fit for Worker communication
5. **No circular refs** - Just IDs pointing to other entities

### Phase 2: Design Worker API
1. Define message protocol between Worker and main thread
2. Design query API for loaders (getContacts, getWires, etc.)
3. Design mutation API for actions (updateContent, connect, etc.)
4. Design change notification system

### Phase 3: Implement Worker Infrastructure
1. Create network-worker.ts with PropagationNetwork instance
2. Create network-client.ts for main thread communication
3. Implement message passing and serialization
4. Add change notifications

### Phase 4: React Router Integration
1. Update loaders to query from Worker
2. Update actions to send mutations to Worker
3. Add revalidation on Worker notifications
4. Remove all global state contexts

### Phase 5: Cleanup
1. Remove NetworkState context
2. Remove ReactFlowContext
3. Remove all sync logic
4. Simplify components to just render loader data

## Worker API Design (Async Message Protocol)

```typescript
// Request/Response pattern with correlation IDs
interface WorkerRequest {
  id: string // Correlation ID for matching responses
  type: string
  payload: unknown
}

interface WorkerResponse {
  id: string // Matches request ID
  type: 'success' | 'error'
  data?: unknown
  error?: string
}

// Query Messages (for React Router loaders)
interface GetStateQuery {
  type: 'GET_STATE'
  groupId: string
}
// Response: { contacts: Contact[], wires: Wire[], group: Group }

interface GetContactQuery {
  type: 'GET_CONTACT'
  contactId: string
}
// Response: Contact | null

// Mutation Messages (for React Router actions)
interface UpdateContentMutation {
  type: 'UPDATE_CONTENT'
  contactId: string
  content: unknown
}
// Response: { changes: ContactUpdate[], contradictions: Contradiction[] }

interface AddContactMutation {
  type: 'ADD_CONTACT'
  groupId: string
  position: Position
  blendMode?: BlendMode
  isBoundary?: boolean
}
// Response: { contactId: string }

interface ConnectMutation {
  type: 'CONNECT'
  fromId: string
  toId: string
  type?: 'bidirectional' | 'directed'
}
// Response: { wireId: string, propagationChanges: ContactUpdate[] }

// Push Notifications (from Worker)
interface PropagationCompleteNotification {
  type: 'PROPAGATION_COMPLETE'
  changes: ContactUpdate[]
  duration: number // ms
}

interface ContradictionNotification {
  type: 'CONTRADICTION_DETECTED'
  contactId: string
  contradiction: Contradiction
}

// Worker Implementation with Scheduler
function createNetworkWorker() {
  let scheduler: PropagationNetworkScheduler = createImmediateScheduler()
  
  // Subscribe to scheduler changes
  scheduler.subscribe((changes) => {
    // Notify main thread of changes
    postMessage({
      type: 'PROPAGATION_COMPLETE',
      changes
    })
  })
  
  async function handleMessage(request: WorkerRequest): Promise<WorkerResponse> {
    try {
      switch (request.type) {
        case 'SET_SCHEDULER':
          // Allow changing scheduler strategy at runtime
          const { strategy, options } = request.payload
          
          // Unsubscribe from old scheduler
          const currentSub = scheduler.subscribe((changes) => {
            postMessage({ type: 'PROPAGATION_COMPLETE', changes })
          })
          
          // Create new scheduler
          switch (strategy) {
            case 'immediate': 
              scheduler = createImmediateScheduler()
              break
            case 'batch': 
              scheduler = createBatchScheduler(options?.batchSize, options?.delay)
              break
            case 'distributed':
              scheduler = createDistributedScheduler()
              break
          }
          
          // Subscribe to new scheduler
          scheduler.subscribe((changes) => {
            postMessage({ type: 'PROPAGATION_COMPLETE', changes })
          })
          
          return { id: request.id, type: 'success' }
          
        case 'UPDATE_CONTENT':
          const { contactId, content } = request.payload as UpdateContentMutation
          await scheduler.scheduleUpdate(contactId, content)
          return { id: request.id, type: 'success' }
          
        case 'GET_STATE':
          const { groupId } = request.payload as GetStateQuery
          const state = await scheduler.getState(groupId)
          return { id: request.id, type: 'success', data: state }
          
        case 'REGISTER_GROUP':
          const { group } = request.payload
          await scheduler.registerGroup(group)
          return { id: request.id, type: 'success' }
          
        case 'CONNECT':
          const { fromId, toId, type } = request.payload as ConnectMutation
          await scheduler.connect(fromId, toId, type)
          return { id: request.id, type: 'success' }
      }
    } catch (error) {
      return { id: request.id, type: 'error', error: error.message }
    }
  }
  
  return { handleMessage }
}

// Worker entry point
const worker = createNetworkWorker()

self.onmessage = async (event) => {
  const response = await worker.handleMessage(event.data)
  postMessage(response)
}
```

## Benefits of Async Propagation

1. **Natural for Distributed Systems**
   - Propagation is inherently async in real networks
   - Easy to extend to WebSocket/HTTP later
   - Can handle network delays gracefully

2. **Better Performance**
   - Can parallelize independent propagations
   - UI never blocks on propagation
   - Can show propagation progress

3. **Cleaner Error Handling**
   - Async functions can properly handle errors
   - Can timeout long propagations
   - Can retry failed propagations

4. **Testability**
   - Pure functions are easy to test
   - Can mock async operations
   - Can test propagation logic in isolation

## Success Criteria

- [ ] PropagationNetwork runs independently in Worker
- [ ] All state flows through React Router loaders
- [ ] No global state management needed
- [ ] Propagation works correctly with blend modes
- [ ] Performance is good (off main thread)
- [ ] Code is radically simpler
- [ ] Async propagation enables future distribution

## Primitive Gadgets Design

Primitive gadgets are the computational building blocks of our propagation networks. They're special groups that execute functions when their inputs change.

### Interface Design
```typescript
interface PrimitiveGadget {
  id: string
  name: string
  
  // Boundary contact IDs for inputs/outputs
  inputIds: string[]  // Maps to input boundary contacts
  outputIds: string[] // Maps to output boundary contacts
  
  // When should this gadget execute?
  activation: (inputs: Map<string, unknown>) => boolean
  
  // What computation to perform
  body: (inputs: Map<string, unknown>) => Promise<Map<string, unknown>>
  
  // Metadata
  description?: string
  category?: 'math' | 'string' | 'array' | 'logic' | 'control'
}
```

### Integration with Groups
Groups can be either regular groups or primitive gadgets:
```typescript
interface Group {
  // ... existing fields ...
  
  // If present, this group behaves as a primitive gadget
  primitive?: PrimitiveGadget
}
```

### Execution Model
1. When input boundary contacts receive new content, the scheduler checks the activation function
2. If activation returns true, the body function executes
3. Results are propagated to output boundary contacts
4. The scheduler treats this as a single atomic operation

### Example Primitives

**Math Operations**
```typescript
const addGadget: PrimitiveGadget = {
  id: 'add',
  name: 'Add',
  inputIds: ['a', 'b'],
  outputIds: ['sum'],
  activation: (inputs) => 
    inputs.has('a') && inputs.has('b') &&
    typeof inputs.get('a') === 'number' &&
    typeof inputs.get('b') === 'number',
  body: async (inputs) => 
    new Map([['sum', inputs.get('a') + inputs.get('b')]])
}
```

**String Operations**
```typescript
const concatGadget: PrimitiveGadget = {
  id: 'concat',
  name: 'Concatenate',
  inputIds: ['str1', 'str2'],
  outputIds: ['result'],
  activation: (inputs) => 
    inputs.has('str1') && inputs.has('str2'),
  body: async (inputs) => 
    new Map([['result', String(inputs.get('str1')) + String(inputs.get('str2'))]])
}
```

**Control Flow**
```typescript
const gateGadget: PrimitiveGadget = {
  id: 'gate',
  name: 'Gate',
  inputIds: ['value', 'condition'],
  outputIds: ['output'],
  activation: (inputs) => 
    inputs.has('value') && inputs.has('condition'),
  body: async (inputs) => 
    inputs.get('condition') ? 
      new Map([['output', inputs.get('value')]]) : 
      new Map()
}
```

### Benefits
1. **Composable** - Primitives can be connected to build complex behaviors
2. **Async-ready** - Body functions are async for future extensions
3. **Type-agnostic** - Works with any data type
4. **Scheduler-friendly** - Fits naturally into our propagation model
5. **Testable** - Each primitive is a pure function

## Next Steps

1. [x] Update this plan with stream architecture
2. [x] Analyze propagation-core for cleanup  
3. [x] Design detailed Worker API
4. [x] Design primitive gadgets
5. [ ] Implement core primitive gadgets
6. [ ] Rewrite propagation-core as functional/async
7. [ ] Implement Worker with async PropagationNetwork
8. [ ] Integrate with React Router
9. [ ] Remove all global state