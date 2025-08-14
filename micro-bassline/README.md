# micro-bassline

A simple stream-based runtime for Bassline. Everything is a stream - values flow through contacts, contacts connect via wires, and the network can inspect and modify itself through special Meta-Group Protocol (MGP) contacts.

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { runtime, defaultPrimitives } from 'micro-bassline'

// Create a runtime with primitive gadgets
const rt = runtime(undefined, defaultPrimitives)

// Create groups and contacts
rt.createGroup('calculator')
rt.createContact('a', 'calculator')
rt.createContact('b', 'calculator')

// Create an adder gadget
rt.createGroup('adder', 'add', {}, 'calculator')

// Wire up the connections
rt.createWire('w1', 'calculator:a', 'adder:a')
rt.createWire('w2', 'calculator:b', 'adder:b')
rt.createWire('w3', 'adder:sum', 'calculator:result', false)

// Set values and watch them propagate
rt.setValue('calculator', 'a', 10)
rt.setValue('calculator', 'b', 20)

// Read the computed result
console.log(rt.getValue('calculator', 'result')) // 30
```

## Meta-Group Protocol (MGP)

Groups can expose their internals as data through special contacts:

```typescript
// Create a group with MGP enabled
rt.createGroup('network', undefined, {
  'expose-structure': true,      // Exposes topology as data
  'expose-dynamics': true,        // Streams all events
  'allow-meta-mutation': true     // Accepts mutations as data
})

// Read the network structure
const structure = rt.getValue('network', 'structure')

// Send mutations through the actions contact
rt.setValue('network', 'actions', ['createContact', 'new-contact', 'network', {}])
```

## Key Features

- **Stream-based**: Values flow through async streams - no polling or manual updates
- **Hierarchical**: Groups contain contacts and other groups
- **Self-describing**: Networks expose their own structure as data
- **Simple persistence**: Save/load with clean structure/data separation
- **No kernel**: No central coordinator - just streams pushing values

## Documentation

- [Architecture](./docs/architecture.md) - How streams simplify everything
- [Meta-Group Protocol](./docs/mgp.md) - Networks that describe themselves
- [API Reference](./docs/api.md) - All functions and types
- [Examples](./docs/examples.md) - Common patterns and recipes

## Testing

```bash
pnpm test        # Run tests in watch mode
pnpm test --run  # Run tests once
pnpm typecheck   # Type checking
```

## License

MIT