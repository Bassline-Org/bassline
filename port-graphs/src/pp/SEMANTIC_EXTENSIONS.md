# Semantic Extensions Documentation

This document describes the semantic extensions built on top of the core Apply/Consider/Act protocol. Each extension defines how gadgets interpret their "act" phase differently while maintaining protocol compatibility.

## Core Protocol

All gadgets follow the same three-step pattern:
```typescript
protocol(apply, consider, act)
```

The protocol itself is agnostic about HOW gadgets act - it only ensures the structure.

## Semantic Extensions

### 1. Event Semantics

**What:** Gadgets act by emitting DOM/EventTarget events  
**How:** Uses browser's built-in event system  
**Dependencies:** 
- Browser environment or Node with EventTarget polyfill
- Gadgets must extend EventTarget or have addEventListener/dispatchEvent

**Example:**
```typescript
const eventCell = cell(
  merge,
  initial,
  (value, gadget) => gadget.dispatchEvent(new CustomEvent('changed', { detail: value }))
);
```

**Use When:** 
- Building browser-based applications
- Need loose coupling between gadgets
- Want to leverage existing event infrastructure

### 2. Direct Call Semantics

**What:** Gadgets act by directly calling other gadgets' receive methods  
**How:** Synchronous function calls  
**Dependencies:** 
- Target gadget reference must be available
- No external runtime required

**Example:**
```typescript
const directCell = cell(
  merge,
  initial,
  (value) => targetGadget.receive(value)
);
```

**Use When:**
- Performance is critical (no event overhead)
- Gadgets have direct references to each other
- Want deterministic, synchronous execution

### 3. Delegation Semantics

**What:** Gadgets act by delegating to a central coordinator  
**How:** All actions go through a single point of control  
**Dependencies:**
- Central coordinator/context must exist
- Gadgets need reference to coordinator

**Example:**
```typescript
const delegatedCell = cell(
  merge,
  initial,
  (value) => coordinator.handle({ from: gadgetId, value })
);
```

**Use When:**
- Need centralized state management (Redux-like)
- Want to intercept/log all actions
- Implementing time-travel debugging

### 4. Effect Description Semantics

**What:** Gadgets act by producing effect descriptions (data)  
**How:** Effects are data that describe what should happen  
**Dependencies:**
- Realizer gadget to interpret effects
- Effect schema/types defined

**Example:**
```typescript
const effectCell = cell(
  merge,
  initial,
  (value, gadget) => realizer.receive({ 
    type: 'UPDATE_DOM',
    target: '#display',
    value 
  })
);
```

**Use When:**
- Want pure, testable gadgets
- Need to batch/optimize effects
- Building declarative systems

### 5. Pool/Assertion Semantics

**What:** Gadgets act by making assertions that cause topology changes  
**How:** Assertions accumulate in pools that create connections  
**Dependencies:**
- Pool gadget to manage assertions
- Gadgets must provide references for wiring

**Example:**
```typescript
const pool = createPool((match) => {
  wire(match.provider.gadget, match.consumer.gadget);
});

// Gadgets assert their capabilities
pool.receive(assert.provides('sensor1', 'temperature', sensorGadget));
pool.receive(assert.needs('display1', 'temperature', displayGadget));
// Pool automatically wires them
```

**Use When:**
- Want self-organizing networks
- Topology should emerge from data
- Building plugin/extension systems

### 6. Message Passing Semantics

**What:** Gadgets act by sending messages (async)  
**How:** Messages queued and processed asynchronously  
**Dependencies:**
- Message queue/channel implementation
- Async runtime (promises, workers)

**Example:**
```typescript
const messageCell = cell(
  merge,
  initial,
  async (value) => {
    await messageQueue.send({ to: 'consumer', value });
  }
);
```

**Use When:**
- Building distributed systems
- Need async/concurrent execution
- Want to decouple timing

### 7. React Integration Semantics

**What:** Gadgets act by updating React state  
**How:** Actions trigger React setState/dispatch  
**Dependencies:**
- React framework
- State management (useState, useReducer, Context)

**Example:**
```typescript
const reactCell = cell(
  merge,
  initial,
  (value) => setReactState(value)
);
```

**Use When:**
- Integrating with React applications
- Need React's rendering optimizations
- Building UI components as gadgets

## Mixing Semantics

Different semantics can coexist in the same network:

```typescript
// Event-based sensor
const sensor = cell(merge, 0, actions.emit('temperature'));

// Direct-call processor  
const processor = fn(transform, actions.direct(storage));

// React UI updater
const display = cell(merge, 0, (value) => setDisplayState(value));

// Pool wires them together
pool.receive(assert.provides('sensor', 'data', sensor));
pool.receive(assert.needs('processor', 'data', processor));
```

## Creating New Semantics

To create a new semantic extension:

1. **Define the action signature:**
```typescript
type MyAction<T> = (value: T, gadget: Gadget) => void;
```

2. **Implement the action:**
```typescript
const mySemanticAction: MyAction<T> = (value, gadget) => {
  // Your custom behavior here
};
```

3. **Use with factories:**
```typescript
const myGadget = cell(merge, initial, mySemanticAction);
```

## Best Practices

1. **Keep actions pure when possible** - Makes testing easier
2. **Document dependencies** - Be clear about what runtime support is needed
3. **Consider composability** - Actions should compose well with others
4. **Handle errors gracefully** - Actions may fail, plan for it
5. **Optimize for your use case** - Choose semantics that match your requirements

## Performance Considerations

| Semantic | Overhead | Latency | Scalability |
|----------|----------|---------|-------------|
| Direct Call | Lowest | Immediate | Limited by call stack |
| Event | Low | Near-immediate | Good (event loop) |
| Delegation | Low | Immediate | Depends on coordinator |
| Effect | Medium | Batched | Excellent |
| Pool | Medium | On match | Good |
| Message | Higher | Async | Excellent |
| React | Medium | Batched | Good (React optimizes) |

## Testing Strategies

Each semantic requires different testing approaches:

- **Direct/Delegation:** Mock target objects
- **Events:** Spy on event methods
- **Effects:** Assert on effect descriptions
- **Pool:** Mock the wiring action
- **Message:** Mock message queue
- **React:** Use React Testing Library

Example:
```typescript
// Testing with mocked action
const mockAction = vi.fn();
const testCell = cell(merge, initial, mockAction);
// ... trigger cell
expect(mockAction).toHaveBeenCalledWith(expectedValue, gadget);
```

## Migration Between Semantics

The beauty of injectable actions is easy migration:

```typescript
// Start with logging
let myCell = cell(merge, initial, actions.log());

// Move to events when ready
myCell = cell(merge, initial, actions.emit('changed'));

// Switch to React when integrating UI
myCell = cell(merge, initial, (v) => setState(v));
```

The core logic (merge function) remains unchanged!