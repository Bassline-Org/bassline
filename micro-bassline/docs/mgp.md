# Meta-Group Protocol (MGP)

MGP lets groups expose their internals as regular contacts. This means you can inspect, monitor, and modify networks just by reading and writing to contacts - no special APIs needed.

## The Three MGP Contacts

### 1. Structure Contact

Exposes the network topology as data:

```typescript
rt.createGroup('parent', undefined, {
  'expose-structure': true
})

const structure = rt.getValue('parent', 'structure')
// Returns: {
//   groups: Map<GroupId, ReifiedGroup>,
//   contacts: Map<ContactId, ReifiedContact>,
//   wires: Map<WireId, ReifiedWire>
// }
```

Features:
- Lazy computation (only computed when read)
- Cached with hash for fast comparison
- Automatically updates when topology changes
- Respects `expose-internals` flag for encapsulation

### 2. Dynamics Contact

Streams all events from descendant groups:

```typescript
rt.createGroup('parent', undefined, {
  'expose-dynamics': true
})

// Subscribe to all child events
const dynamics = rt.contacts.get('parent:dynamics')
dynamics.onValueChange(event => {
  // event: ['valueChanged', contactId, oldValue, newValue]
  console.log('Child event:', event)
})
```

Event types:
- `valueChanged`: Contact value updated
- `propagating`: Value flowing through wire
- `gadgetActivated`: Primitive gadget executed
- `contradiction`: Merge conflict detected

### 3. Actions Contact

Accepts mutations as data:

```typescript
rt.createGroup('parent', undefined, {
  'allow-meta-mutation': true
})

// Send mutations through the actions contact
rt.setValue('parent', 'actions', 
  ['createContact', 'new-contact', 'parent', { blendMode: 'merge' }]
)

// Batch multiple actions
rt.setValue('parent', 'actions', [
  ['createGroup', 'child', 'parent', {}],
  ['createContact', 'input', 'child', {}],
  ['setValue', 'child', 'input', 42]
])
```

## Dynamic MGP Management

MGP contacts are created/destroyed based on properties:

```typescript
const rt = runtime()
rt.createGroup('network')

// No MGP contacts initially
console.log(rt.contacts.get('network:structure')) // undefined

// Enable structure dynamically
rt.setValue('network', 'properties', {
  'expose-structure': true
})

// Structure contact now exists
console.log(rt.contacts.get('network:structure')) // Contact instance
```

When disabled:
- Contact is deleted
- All connected wires are removed
- Event subscriptions are cleaned up
- Ensures clean serialization

## Network Synchronization

Connect two networks using MGP:

```typescript
// Network 1: Source
const net1 = runtime()
net1.createGroup('source', undefined, {
  'expose-dynamics': true
})

// Network 2: Target
const net2 = runtime()
net2.createGroup('target', undefined, {
  'allow-meta-mutation': true
})

// Bridge: dynamics → actions
const dynamics = net1.contacts.get('source:dynamics')
const actions = net2.contacts.get('target:actions')

dynamics.onValueChange(event => {
  // Convert dynamics events to actions
  if (event[0] === 'valueChanged') {
    const [_, contactId, oldVal, newVal] = event
    actions.setValue(['setValue', contactId, newVal])
  }
})
```

## Use Cases

### 1. Visual Programming Tools

```typescript
// Editor watches structure for live updates
structure.onValueChange(topology => {
  renderGraph(topology)
})

// User actions become network mutations
onNodeCreated(node => {
  actions.setValue(['createContact', node.id, groupId, {}])
})
```

### 2. Time-Travel Debugging

```typescript
const actionHistory = []

// Record all actions
actions.onValueChange(action => {
  actionHistory.push({ action, timestamp: Date.now() })
})

// Replay to any point
function replayTo(timestamp) {
  const newRuntime = runtime()
  actionHistory
    .filter(a => a.timestamp <= timestamp)
    .forEach(a => newRuntime.applyAction(a.action))
  return newRuntime
}
```

### 3. Distributed Systems

```typescript
// Serialize and send structure
websocket.send(JSON.stringify({
  type: 'structure',
  data: structure.getValue()
}))

// Forward actions across network
actions.onValueChange(action => {
  websocket.send(JSON.stringify({
    type: 'action',
    data: action
  }))
})
```

## Properties Reference

| Property | MGP Contact | Description |
|----------|-------------|-------------|
| `expose-structure` | structure | Exposes network topology |
| `expose-internals` | (modifier) | Include internal contacts in structure |
| `expose-dynamics` | dynamics | Streams descendant events |
| `allow-meta-mutation` | actions | Accepts mutations as data |
| `distributed-mode` | (modifier) | Disables actions in distributed mode |

## Best Practices

1. **Lazy Structure**: Structure contact uses lazy computation - read it sparingly
2. **Event Filtering**: Filter dynamics events early to reduce processing
3. **Action Batching**: Send multiple actions in arrays for atomic updates
4. **Property Control**: Use properties to enable/disable MGP dynamically
5. **Clean Shutdown**: MGP contacts auto-cleanup when disabled

## Why MGP Matters

With MGP, the network becomes its own API:
- Want to visualize the network? Read the structure contact
- Want to monitor activity? Subscribe to the dynamics contact  
- Want to modify the network? Write to the actions contact

No special tools or protocols needed - everything is just data flowing through contacts.