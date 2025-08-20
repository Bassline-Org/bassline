# Atto-Bassline

Ultra-minimal strength-based signal propagation network with strict conservation and halting guarantees.

## Overview

Atto-Bassline is a computational model where information flows as signals carrying both values and strength (confidence/priority). The system uses strict argmax propagation (>) to guarantee halting and provides contradiction detection for equal-strength conflicts.

## Key Features

- **Strict Argmax Propagation**: Signals only propagate on strictly increasing strength (>)
- **Halting Guaranteed**: Finite strength space ensures termination
- **Contradiction Detection**: Equal-strength conflicts produce contradiction signals
- **Gain Conservation**: Strict conservation model with auditable receipts
- **Boot System**: Reproducible network initialization via boot scripts
- **Integer Strength**: Avoids floating-point errors (10,000 units = 1.0)

## Installation

```bash
npm install atto-bassline
```

## Quick Start

```typescript
import { 
  bootNetwork, 
  createGadget, 
  createContact,
  wire,
  signal,
  propagate 
} from 'atto-bassline'

// Initialize network with boot script
const network = await bootNetwork({
  version: "1.0",
  bootstrap: {
    userControl: {
      id: "user",
      initialGain: 100000  // 10.0 worth of gain
    }
  }
})

// Create gadgets
const a = createGadget('a')
const b = createGadget('b')

// Create contacts
const aOut = createContact('out', a, signal(5, 1.0), 'output')
const bIn = createContact('in', b, signal(null, 0), 'input')

// Wire them together
wire(aOut, bIn)

// Propagate signal
propagate(aOut, signal(10, 1.5))  // Strength must be > 1.0 to propagate
```

## Core Concepts

### Signals

Every piece of information carries strength:

```typescript
interface Signal {
  value: Value      // The actual data
  strength: number  // Integer units (10000 = 1.0)
}
```

### Propagation Rules

**Strict > Semantics**: Signals ONLY propagate on strictly increasing strength:

```typescript
// ✅ Will propagate
propagate(contact, signal(value, 1.5))  // 1.5 > current

// ❌ Won't propagate  
propagate(contact, signal(value, 1.0))  // 1.0 = current

// 🔴 Creates contradiction
propagate(contact, signal(differentValue, 1.0))  // Equal strength, different value
```

### Boot System

Networks initialize via auditable boot scripts:

```typescript
const bootScript = {
  version: "1.0",
  bootstrap: {
    userControl: {
      id: "user-socket",
      initialGain: 100000,
      authority: "root"
    },
    initialGadgets: [{
      id: "minter",
      type: "gainMinter",
      gain: 10000,
      authority: "mint"
    }]
  },
  policy: {
    gainConservation: "strict",
    propagationSemantics: "argmax-strict"
  }
}

const network = await bootNetwork(bootScript)
```

### Gain Conservation

The system enforces strict gain conservation:

1. **Bootstrap Phase**: One-time gain creation with receipts
2. **Runtime Phase**: No gain creation without authority
3. **Authorized Minting**: Only designated gadgets can mint
4. **Auditable**: All operations generate receipts

```typescript
// Transistor amplification requires gain
const transistor = createTransistor('amp')
transistor.gainPool = 5000  // Must have gain to amplify

// Amplify signal (consumes gain)
propagate(transistor.contacts.get('control'), signal(3000, 1.0))
propagate(transistor.contacts.get('input'), signal('data', 0.5))
// Output: signal('data', 0.8) - amplified by 0.3
```

## Primitive Gadgets

Built-in computational units:

```typescript
// Math operations
const adder = createAdder('add')
const multiplier = createMultiplier('mult')

// Logic operations  
const andGate = createAnd('and')
const orGate = createOr('or')

// String operations
const concat = createConcatenator('concat')

// Special gadgets
const transistor = createTransistor('amp')  // Signal amplification
const minter = createGainMinter('mint')     // Authorized gain creation
```

## Advanced Features

### Dynamic Gadgets

Create gadgets from specifications:

```typescript
const spec = {
  structure: {
    contacts: {
      'input': { direction: 'input' },
      'output': { direction: 'output' }
    }
  },
  bindings: {
    behavior: '__behavior'
  }
}

const dynamic = createDynamicGadget('dynamic', spec)
```

### Spawners

Create new gadgets at runtime:

```typescript
const spawner = createSpawner('spawner')
const template = {
  tag: 'template',
  value: {
    spec: {
      structure: {
        contacts: {
          'data': { direction: 'input' }
        }
      }
    }
  }
}

propagate(spawner.contacts.get('template'), signal(template, 1.0))
propagate(spawner.contacts.get('trigger'), signal(true, 1.5))
```

## Testing

```bash
npm test                    # Run all tests
npm test propagation       # Run specific test suite
npm test -- --watch       # Watch mode
```

## Documentation

- [SPECIFICATION.md](SPECIFICATION.md) - Complete system specification
- [PROPAGATION.md](PROPAGATION.md) - Propagation semantics in detail
- [spawners.md](spawners.md) - Dynamic gadget system

## Design Principles

1. **Strict Halting**: Guaranteed termination via strictly increasing strength
2. **Conservation**: No gain creation without authority
3. **Auditability**: All operations generate receipts
4. **Simplicity**: Core engine < 250 lines
5. **Type Safety**: Contradictions as first-class values

## License

MIT