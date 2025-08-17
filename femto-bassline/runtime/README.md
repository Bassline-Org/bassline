# Runtime Module

The runtime module implements the execution engine for Femto-Bassline, including the binder (mutation controller) and aspect system.

## Key Components

### Binder (`binder.ts`)

The **Binder** is the sole authority for structural mutations in the system. It:

- Maintains the desired state (BoardIR)
- Validates and applies mutation plans
- Lowers IR to realized graph (with aspect shims)
- Tracks all changes with full provenance
- Enforces policies and access control

#### Core Principles

1. **Single Writer**: Only one binder per board, ensuring serialized mutations
2. **Plan-Based**: All changes go through validated plans
3. **Idempotent**: Plans can be safely retried
4. **Auditable**: Every change produces a receipt with provenance

#### Usage Example

```typescript
import { createBinder, createDefaultAspectRegistry } from './runtime';

const binder = createBinder('board://my-board', {
  aspectRegistry: createDefaultAspectRegistry(),
  latticeCatalog: createDefaultCatalog(),
  principal: 'user-123'
});

// Apply a plan to declare a slot
const receipt = await binder.apply({
  id: 'plan-1',
  op: 'declareSlot',
  slot: createSlotId('input'),
  requires: createPinoutId('value-io')
});

if (receipt.status === 'ok') {
  console.log('Slot created successfully');
}
```

### Aspect System (`aspects.ts`)

The **Aspect System** provides opt-in extensibility without polluting the core model:

- **Data-plane aspects** (wire/pin/slot) → become shim gadgets
- **Control-plane aspects** (board/binder) → become rewriter passes
- **Canonical ordering** via orderKey ensures determinism
- **Lattice composition** for overlapping configurations

#### Aspect Scopes

1. **Wire Aspects**: Transform data between contacts
   - Join points: `tapIn`, `tapOut`, `around`
   - Realized as shim gadgets in the wire

2. **Pin Aspects**: Filter/validate at port boundaries
   - Applied to all data entering/exiting a pin
   - Useful for schema validation

3. **Slot Aspects**: Wrap gadgets with behavior
   - Applied to gadgets mounted in slots
   - Examples: retry logic, resource limits

4. **Board Aspects**: Domain-wide policies
   - Applied across all children
   - Examples: default tracing, rate limits

5. **Binder Aspects**: Control plane extensions
   - Modify validation/planning logic
   - Examples: custom ACLs, policy enforcement

#### Built-in Aspects

- **Tap**: Observability for wire values
- **RateLimit**: Throttle propagation
- **CreditGate**: Credit-based flow control
- **Validation**: Structural validation rules

## Design Decisions

### Why Single-Writer Binder?

Serializing mutations through a single binder ensures:
- No race conditions in structural changes
- Clear audit trail of who changed what
- Simplified reasoning about system evolution
- Ability to replay/rollback changes

### Why Canonical Aspect Ordering?

Deterministic aspect composition is critical for:
- Reproducible behavior across runs
- Predictable debugging
- Safe distribution (all nodes order the same)
- Testing and verification

### Why Lowering Instead of Direct Execution?

The two-phase approach (IR → Realized) enables:
- Clean separation of desired vs actual state
- Aspect weaving without IR pollution
- Optimization opportunities
- Multiple backend targets (interpreter, compiler, etc.)

## Invariants

1. **IR Immutability**: The binder never mutates IR in place
2. **Receipt Completeness**: Every plan produces exactly one receipt
3. **Provenance Chain**: Every structural change is tracked
4. **Aspect Determinism**: Same aspects always compose the same way
5. **Graph Consistency**: Realized graph always reflects current IR

## Common Patterns

### Batch Operations

```typescript
const plans = [
  { op: 'declareSlot', ... },
  { op: 'mount', ... },
  { op: 'addWire', ... }
];

const receipts = await applyPlans(binder, plans);
```

### Aspect Installation

```typescript
// Install rate limiting on all wires with a label
await binder.apply({
  op: 'weaveWires',
  selector: { hasTag: 'throttled' },
  aspect: {
    id: createAspectId('rate-limit', 1),
    at: 'tapIn',
    params: { rps: 100, burst: 10 }
  }
});
```

### Dry Run Validation

```typescript
const validation = await binder.apply({
  op: 'validate',
  dryRun: true
});
```

## Testing

The runtime module should be tested with:
- Unit tests for plan validation
- Integration tests for lowering
- Property tests for aspect composition
- Replay tests for determinism