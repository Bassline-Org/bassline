# Bassline Architecture Plan

## Core Principles
1. **Headless First**: The propagation engine should work without any UI
2. **Clear Boundaries**: Strict separation between core logic and UI adapters
3. **Simple Models**: Follow the Smalltalk pattern - ContactGroups own wires
4. **Event-Driven**: Use events for loose coupling between layers

## Layer Structure

### 1. Core Library (`/app/propagation-core/`)
Pure business logic, no React dependencies:

```
propagation-core/
├── models/
│   ├── Contact.ts          # Basic contact with content and position
│   ├── Wire.ts            # Connection between two contacts
│   ├── ContactGroup.ts    # Container that owns contacts and wires
│   └── BlendMode.ts       # Content merging strategies
├── engine/
│   └── PropagationEngine.ts # Handles content propagation
├── events/
│   └── EventBus.ts        # Simple event emitter
└── index.ts               # Public API
```

### 2. React Adapter (`/app/propagation-react/`)
Maps core models to React Flow:

```
propagation-react/
├── hooks/
│   └── usePropagationNetwork.ts  # React hook for network state
├── adapters/
│   ├── nodeAdapter.ts     # Contact/Group → React Flow Node
│   └── edgeAdapter.ts     # Wire → React Flow Edge
└── index.ts
```

### 3. UI Components (`/app/components/`)
React components that use the adapter:

```
components/
├── NetworkEditor.tsx      # Main editor using React Flow
├── nodes/
│   ├── ContactNode.tsx
│   └── GroupNode.tsx
└── edges/
    └── WireEdge.tsx
```

## Core API Design

```typescript
// Create a network
const network = new PropagationNetwork();

// Add contacts
const c1 = network.addContact({ x: 0, y: 0 });
const c2 = network.addContact({ x: 100, y: 0 });

// Connect them
const wire = network.connect(c1.id, c2.id);

// Set content
c1.setContent(42);

// Content propagates automatically
console.log(c2.content); // 42

// Create groups
const group = network.createGroup("Adder");
const input1 = group.addBoundaryContact({ x: 0, y: 20 });
const output = group.addBoundaryContact({ x: 50, y: 20 });

// Groups can be nested
const subgroup = group.createSubgroup("Multiplier");
```

## React Integration

```typescript
// In React component
const { nodes, edges, onConnect, updateContent } = usePropagationNetwork(network);

return (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    onConnect={onConnect}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
  />
);
```

## Key Changes from Current Implementation

1. **Remove UI concerns from models** - No React imports in core
2. **Contacts don't track connections** - Groups own all wires
3. **Simple wire resolution** - A wire just has from/to IDs
4. **Adapter handles complexity** - React Flow mapping happens in one place
5. **Events for updates** - Core emits events, React adapter subscribes

## Migration Steps

1. Create new `propagation-core` directory
2. Implement basic Contact, Wire, Group models
3. Build simple propagation engine
4. Write tests for core functionality
5. Create React adapter layer
6. Refactor UI components to use adapter
7. Remove old mixed implementation

This approach will make the system much easier to understand and debug!