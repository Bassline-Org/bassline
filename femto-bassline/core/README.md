# Core Module

The core module provides the foundational types and abstractions for Femto-Bassline. It is designed to be **pure TypeScript with no external dependencies** (except Zod for validation), making it portable and easy to reason about.

## Key Concepts

### Type System (`types.ts`)

All core types are defined using Zod schemas, providing both compile-time type safety and runtime validation:

#### ID Types
- **GadgetId**: `gadget://${string}` - Identifies a gadget instance
- **BoardId**: `board://${string}` - Identifies a board (mutable gadget container)
- **SlotId**: `slot://${string}` - Identifies a slot within a board
- **WireId**: `wire://${string}` - Identifies a wire connection
- **PinoutId**: `pinout://${string}` - Identifies a pinout specification
- **AspectId**: `aspect://${string}@${version}` - Identifies an aspect with version

#### Provenance
Every structural change is tracked with provenance:
```typescript
{
  by: string;        // Who made the change
  at: string;        // When (ISO timestamp)
  reason?: string;   // Why (human readable)
  passId?: string;   // Which rewriter pass
  inputsHash?: string; // Hash of inputs
}
```

#### Pins and Pinouts
Pins define the interface of gadgets:
- **PulseIn/Out**: Trigger-based propagation
- **ValueIn/Out**: Lattice value propagation  
- **ActionIn**: Command reception
- **EventOut**: Event emission

#### Traits and Evidence
Traits are properties that gadgets can claim with supporting evidence:
- `deterministic`: Always produces same output for same input
- `pure`: No side effects
- `bounded-memory`: Memory usage is bounded
- `crdt-safe`: Safe for CRDT operations

### Lattice System (`lattice.ts`)

Lattices provide the mathematical foundation for deterministic composition and convergence.

#### Core Properties
Every lattice must satisfy:
- **Partial Order**: Reflexive, antisymmetric, transitive
- **Join Operation**: Commutative, associative, idempotent
- **Bottom Element**: Identity for join operation

#### Built-in Lattices

**Control Lattices:**
- `PauseLattice`: States from `running` → `soft` → `gated` → `isolated`
- `RateLimitLattice`: Composes rate limits by taking minimum (most restrictive)
- `FenceLattice`: Tracks encountered fence IDs for coordination

**Data Lattices:**
- `MaxIntLattice`: Natural number ordering with max as join
- `MinIntLattice`: Reversed ordering with min as join
- `BoolOrLattice`: false < true with OR as join
- `BoolAndLattice`: true < false with AND as join
- `SetUnionLattice<T>`: Subset ordering with union as join
- `MapMergeLattice<K,V>`: Merges maps by joining values

#### Lattice Catalog
The catalog provides a registry for lattices:
```typescript
const catalog = createDefaultCatalog();
const pauseLattice = catalog.get<PauseState>('Pause');
```

### Graph IR (`ir.ts`)

The Intermediate Representation defines the desired state of the system.

#### Two-View Architecture
1. **Desired IR (BoardIR)**: What we want the system to look like
2. **Realized Graph**: The actual runtime graph with shims and aspects applied

This separation enables:
- Declarative configuration
- Atomic updates via binder
- Full provenance tracking
- Deterministic lowering

## Design Decisions

### Why Branded Strings for IDs?
Using Zod's `.brand()` gives us nominal typing for IDs, preventing accidental mixing of different ID types while keeping them as strings for easy serialization.

### Why Lattices?
Lattices ensure that:
- Concurrent updates always converge
- Composition is deterministic
- No coordination needed for consistency
- System naturally handles partial information

### Why Provenance Everywhere?
Every change is tracked because:
- Debugging distributed systems requires audit trails
- Regulatory compliance needs attestation
- Optimization requires understanding patterns
- Trust requires transparency

## Invariants

1. **Lattice Laws**: All lattice operations must satisfy mathematical properties
2. **ID Uniqueness**: IDs must be globally unique within their type
3. **Provenance Completeness**: Every structural change must have provenance
4. **Type Safety**: All data crossing boundaries must be validated

## Common Pitfalls

### Don't Break Lattice Laws
❌ Wrong:
```typescript
join(a, b) !== join(b, a) // Not commutative!
```

✅ Right:
```typescript
join(a, b) === join(b, a) // Commutative
```

### Don't Mix ID Types
❌ Wrong:
```typescript
const gadgetId: GadgetId = 'board://foo'; // Type mismatch!
```

✅ Right:
```typescript
const gadgetId = createGadgetId('foo'); // gadget://foo
```

### Don't Forget Bottom Elements
❌ Wrong:
```typescript
const lattice: Lattice<number> = {
  join: Math.max,
  // Missing bottom!
};
```

✅ Right:
```typescript
const lattice: Lattice<number> = {
  join: Math.max,
  bottom: () => 0, // Identity for max
};
```

## API Examples

### Creating IDs
```typescript
import { createGadgetId, createWireId } from './types';

const gadget = createGadgetId('my-adder');
const wire = createWireId('input-to-adder');
```

### Using Lattices
```typescript
import { PauseLattice, createDefaultCatalog } from './lattice';

// Direct usage
const state1 = PauseLattice.join('running', 'gated'); // 'gated'

// Via catalog
const catalog = createDefaultCatalog();
const pause = catalog.get<PauseState>('Pause');
const state2 = pause.join('soft', 'isolated'); // 'isolated'
```

### Type Validation
```typescript
import { GadgetSpec } from './types';

const spec = {
  pinouts: ['pinout://basic-math'],
  params: { operation: 'add' }
};

// Runtime validation
const validated = GadgetSpec.parse(spec);
```

## Testing

The core module should be extensively tested with:
- Property-based tests for lattice laws
- Validation tests for all Zod schemas
- Round-trip tests for serialization
- Invariant checking for all operations