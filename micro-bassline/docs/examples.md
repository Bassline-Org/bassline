# Examples

## Basic Calculator Network

Create a simple calculator that adds and multiplies:

```typescript
import { runtime, defaultPrimitives } from 'micro-bassline'

const rt = runtime(undefined, defaultPrimitives)

// Create the calculator group
rt.createGroup('calc')

// Create input contacts
rt.createContact('x', 'calc')
rt.createContact('y', 'calc')
rt.createContact('z', 'calc')

// Create an adder: sum = x + y
rt.createGroup('adder', 'add', {}, 'calc')
rt.createWire('w1', 'calc:x', 'adder:a')
rt.createWire('w2', 'calc:y', 'adder:b')

// Create a multiplier: product = sum * z
rt.createGroup('mult', 'multiply', {}, 'calc')
rt.createWire('w3', 'adder:sum', 'mult:a')
rt.createWire('w4', 'calc:z', 'mult:b')

// Create output contact
rt.createContact('result', 'calc')
rt.createWire('w5', 'mult:product', 'calc:result', false)

// Test it
rt.setValue('calc', 'x', 2)
rt.setValue('calc', 'y', 3)
rt.setValue('calc', 'z', 4)

console.log(rt.getValue('calc', 'result'))  // 20 = (2 + 3) * 4
```

## Live Network Visualization

Watch network changes in real-time:

```typescript
const rt = runtime()

// Create a network with structure exposed
rt.createGroup('network', undefined, {
  'expose-structure': true,
  'expose-dynamics': true
})

// Watch structure changes
const structureContact = rt.contacts.get('network:structure')!
structureContact.onValueChange(structure => {
  console.log('Network topology changed:')
  console.log(`  Groups: ${structure.groups.size}`)
  console.log(`  Contacts: ${structure.contacts.size}`)
  console.log(`  Wires: ${structure.wires.size}`)
})

// Watch all events
const dynamicsContact = rt.contacts.get('network:dynamics')!
dynamicsContact.onValueChange(event => {
  const [type, ...data] = event
  console.log(`Event: ${type}`, data)
})

// Make changes and see them logged
rt.createGroup('child', undefined, {}, 'network')
rt.createContact('sensor', 'child')
rt.setValue('child', 'sensor', 42)
```

## Bidirectional Constraints

Create contacts that maintain relationships:

```typescript
const rt = runtime()
rt.createGroup('temps')

// Create Celsius and Fahrenheit contacts
rt.createContact('celsius', 'temps', 'merge')
rt.createContact('fahrenheit', 'temps', 'merge')

// Create converters using gadgets
rt.createGroup('c2f', undefined, {}, 'temps')
rt.createContact('c', 'c2f', 'merge', { isBoundary: true })
rt.createContact('f', 'c2f', 'merge', { isBoundary: true })

// Manual conversion logic (in real app, use custom gadget)
const c2fContact = rt.contacts.get('c2f:c')!
c2fContact.onValueChange(celsius => {
  const fahrenheit = celsius * 9/5 + 32
  rt.setValue('c2f', 'f', fahrenheit)
})

// Wire bidirectionally
rt.createWire('w1', 'temps:celsius', 'c2f:c', true)
rt.createWire('w2', 'c2f:f', 'temps:fahrenheit', true)

// Set Celsius, get Fahrenheit
rt.setValue('temps', 'celsius', 0)
console.log(rt.getValue('temps', 'fahrenheit'))  // 32

// Note: Full bidirectional conversion requires two converters
```

## Network Synchronization

Sync two independent networks:

```typescript
// Network 1: Master
const master = runtime()
master.createGroup('data', undefined, {
  'expose-dynamics': true
})
master.createContact('value', 'data')

// Network 2: Replica
const replica = runtime()
replica.createGroup('data', undefined, {
  'allow-meta-mutation': true
})

// Create sync bridge
const masterDynamics = master.contacts.get('data:dynamics')!
const replicaActions = replica.contacts.get('data:actions')!

// Forward all changes from master to replica
masterDynamics.onValueChange(event => {
  if (event[0] === 'valueChanged') {
    const [_, contactId, oldVal, newVal] = event
    // Extract local contact name from qualified ID
    const localId = contactId.split(':')[1]
    replicaActions.setValue(['setValue', 'data', localId, newVal])
  }
})

// Test synchronization
master.setValue('data', 'value', 'Hello')
setTimeout(() => {
  console.log(replica.getValue('data', 'value'))  // 'Hello'
}, 10)
```

## Persistence and Loading

Save and restore network state:

```typescript
import { exportGroup, importGroup } from 'micro-bassline'

// Create and populate a network
const rt1 = runtime(undefined, defaultPrimitives)
rt1.createGroup('app')
rt1.createContact('username', 'app')
rt1.createContact('score', 'app')
rt1.setValue('app', 'username', 'Alice')
rt1.setValue('app', 'score', 100)

// Export the network
const saved = exportGroup(rt1, 'app')
console.log('Saved structure:', saved.structure)
console.log('Saved data:', saved.data)

// Import into a new runtime
const rt2 = runtime(undefined, defaultPrimitives)
const appId = importGroup(rt2, saved)

// Verify restoration
console.log(rt2.getValue(appId, 'username'))  // 'Alice'
console.log(rt2.getValue(appId, 'score'))     // 100
```

## Time-Travel Debugging

Record and replay network evolution:

```typescript
const rt = runtime()
const history: Array<{ action: any, timestamp: number }> = []

// Create a network with actions recording
rt.createGroup('app', undefined, {
  'allow-meta-mutation': true
})

// Record all actions
const actionsContact = rt.contacts.get('app:actions')!
actionsContact.onValueChange(action => {
  history.push({ action, timestamp: Date.now() })
})

// Make some changes through actions
rt.setValue('app', 'actions', ['createContact', 'counter', 'app', {}])
rt.setValue('app', 'actions', ['setValue', 'app', 'counter', 0])
rt.setValue('app', 'actions', ['setValue', 'app', 'counter', 1])
rt.setValue('app', 'actions', ['setValue', 'app', 'counter', 2])

// Create a snapshot at any point in time
function createSnapshot(upToIndex: number) {
  const snapshot = runtime()
  snapshot.createGroup('app')
  
  history.slice(0, upToIndex).forEach(({ action }) => {
    snapshot.applyAction(action)
  })
  
  return snapshot
}

// Go back to when counter was 1
const snapshot = createSnapshot(3)
console.log(snapshot.getValue('app', 'counter'))  // 1
```

## Custom Gadgets

Create your own computational gadgets:

```typescript
import { gadget, guards } from 'micro-bassline'

// Define a custom average gadget
const averageGadget = gadget({
  inputs: ['values'],
  outputs: ['average', 'count'],
  guards: [
    guards.hasInputs('values'),
    (inputs: any) => Array.isArray(inputs.values)
  ],
  execute: ({ values }) => {
    const sum = values.reduce((a: number, b: number) => a + b, 0)
    return {
      average: values.length > 0 ? sum / values.length : 0,
      count: values.length
    }
  }
})

// Use it in a runtime
const rt = runtime()
rt.createGroup('stats')
rt.createContact('measurements', 'stats')

// Create the averager group and apply gadget
const averager = rt.createGroup('averager', undefined, {}, 'stats')
rt.createContact('values', 'averager', 'merge', { isBoundary: true })
rt.createContact('average', 'averager', 'merge', { isBoundary: true })
rt.createContact('count', 'averager', 'merge', { isBoundary: true })
averageGadget(averager)

// Wire and test
rt.createWire('w1', 'stats:measurements', 'averager:values')
rt.setValue('stats', 'measurements', [10, 20, 30, 40, 50])

console.log(rt.getValue('averager', 'average'))  // 30
console.log(rt.getValue('averager', 'count'))    // 5
```

## Distributed Execution

Run parts of a network in different processes:

```typescript
// Process 1: Sensor network
const sensors = runtime()
sensors.createGroup('telemetry', undefined, {
  'expose-dynamics': true
})
sensors.createContact('temperature', 'telemetry')
sensors.createContact('pressure', 'telemetry')

// Simulate sensor readings
setInterval(() => {
  sensors.setValue('telemetry', 'temperature', Math.random() * 100)
  sensors.setValue('telemetry', 'pressure', Math.random() * 50)
}, 1000)

// Process 2: Analytics network  
const analytics = runtime()
analytics.createGroup('processing', undefined, {
  'allow-meta-mutation': true
})

// Connect via any transport (WebSocket, IPC, etc.)
// This example uses direct connection
const sensorEvents = sensors.contacts.get('telemetry:dynamics')!
const analyticsActions = analytics.contacts.get('processing:actions')!

sensorEvents.onValueChange(event => {
  // Forward events as actions to analytics network
  if (event[0] === 'valueChanged') {
    analyticsActions.setValue(event)
  }
})
```