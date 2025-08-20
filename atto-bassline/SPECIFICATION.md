# Atto-Bassline System Specification

Version: 2.0.0  
Status: Complete with Boot System

## Overview

Atto-Bassline is an ultra-minimal strength-based signal propagation network with strict conservation and halting guarantees. It models computation as signals flowing through a network of gadgets, where each signal carries both a value and a strength representing confidence or refinement level.

## Core Concepts

### 1. Signals

Every piece of information is a signal with two components:

```typescript
interface Signal {
  value: Value      // The actual data (JSON-compatible)
  strength: number  // Integer strength in units (10000 = 1.0)
}
```

**Integer Strength System:**
- Uses integers to avoid floating point errors
- 1 STRENGTH = 10000 units (like Ethereum's wei)
- 10000 units = 1.0 (100%)
- 100 units = 0.01 (1%) 
- 1 unit = 0.0001 (0.01%)

**Strength represents:**
- Confidence in the value
- Refinement level (more specific = higher strength)
- Trust in the source
- Priority in conflict resolution

### 2. Values

Values are JSON-compatible types with support for tagged values:

```typescript
type Value = 
  | null
  | boolean
  | number
  | string
  | Value[]                    // Arrays
  | { [key: string]: Value }   // Objects (including tagged values)
```

### 3. Gadgets

Gadgets are the fundamental processing units:

```typescript
interface Gadget {
  id: string
  contacts: Map<string, Contact>  // Connection points
  gadgets: Map<string, Gadget>    // Sub-gadgets
  compute?: Function               // Optional computation
  primitive?: boolean              // Marks primitive gadgets
  parent?: WeakRef<Gadget>        // Optional parent reference
}
```

**Gadgets are always active** - they respond when ALL required inputs have values.

### 4. Contacts

Contacts are connection points on gadgets:

```typescript
interface Contact {
  id: string
  signal: Signal
  gadget: WeakRef<Gadget>         // Owning gadget
  sources: Set<WeakRef<Contact>>  // Input connections
  targets: Set<WeakRef<Contact>>  // Output connections
  direction: 'input' | 'output'
  boundary: boolean
}
```

### 5. Wires

Wires are dumb connections between contacts. They simply forward signals without modification. All signal manipulation happens in gadgets.

## Propagation Rules

### Strict Argmax (>)

Signals propagate ONLY on strictly increasing strength to guarantee halting:

```typescript
// Strict > semantics (no hysteresis)
if (newSignal.strength > currentSignal.strength) {
  currentSignal = newSignal
} else if (newSignal.strength === currentSignal.strength) {
  if (newSignal.value !== currentSignal.value) {
    // Equal strength, different values = contradiction
    currentSignal = {
      value: { tag: 'contradiction', value: 'Conflict detected' },
      strength: newSignal.strength
    }
  }
  // Equal strength, same value = no propagation
}
```

**Key Properties:**
- Halting guaranteed (finite strength space)
- Contradiction detection for equal-strength conflicts
- No oscillation possible

**Important:** When testing gadgets that need multiple inputs, ensure each signal has strictly increasing strength:
```typescript
propagate(input1, signal(value1, 1.0))    // 10000 units
propagate(input2, signal(value2, 1.1))    // 11000 units (must be strictly greater)
propagate(input3, signal(value3, 1.2))    // 12000 units
```

### Computation Timing

**Critical Rule:** Primitive gadgets only compute when ALL inputs have non-null values with non-zero strength.

```typescript
// For primitive gadgets, check all inputs are ready:
for (const [name, signal] of inputs) {
  if (signal.value === null || signal.strength === 0) {
    return // Don't compute yet
  }
}
```

This prevents partial computations and ensures gadgets see complete input sets.

### Information Loss Principle

Primitive gadgets that destroy information (like addition) output the **minimum** strength of their inputs:

```typescript
add(a: 9000 units, b: 4000 units) → output: 4000 units
```

This ensures confidence naturally decreases through computation chains.

## Type System

### Tagged Values

Complex types use tagged values:

```typescript
interface Tagged<T = any> {
  tag: string
  value: T
}
```

Common tagged types:
```typescript
{tag: "interval", value: [3, 7]}  // Intervals as pairs
{tag: "complex", value: {real: 3, imag: 4}}
{tag: "contradiction", value: {reason: "...", sources: [...]}}
{tag: "some", value: 42}  // Option type
{tag: "none", value: null}
```

### Contradictions

Type errors produce contradiction values that flow through the network:

```typescript
{
  tag: "contradiction",
  value: {
    reason: "Type error: expected number",
    sources: ["hello", 5],
    location: "add-gadget"
  }
}
```

Contradictions have strength like any signal - strong contradictions overpower weak valid signals.

### Serialization

The system provides human-readable serialization:

```typescript
stringify(value: Value): string
parse(str: string): Value
```

**Stringify examples:**
- Numbers/strings/booleans: `"42"`, `"hello"`, `"true"`
- Arrays: `"[1, 2, 3]"`
- Objects: `"{a: 1, b: 2}"`
- Contradictions: `"<contradiction: Type error>"`
- Options: `"Some(42)"`, `"None"`
- Tagged values: `"<interval: [3, 7]>"`

## Special Gadgets

### 1. Transistor

Linearly adjusts signal strength by a control value:

```
# Attenuation (control < 0, always allowed)
Input (strength: 8000) + Control (-3000) → Output (strength: 5000)

# Pass-through (control = 0)
Input (strength: 5000) + Control (0) → Output (strength: 5000)

# Amplification (control > 0, requires gain)
Input (strength: 4000) + Control (+3000) → Output (strength: 7000)
  Consumes: 3000 units from gain pool

# Kill signal (control = KILL_SIGNAL)
Input (strength: 9000) + Control (KILL) → Output (strength: 0)
```

**Control semantics:**
- `KILL_SIGNAL`: Instant mute to 0
- Negative: Reduce strength (free, reduces entropy)
- Zero: Pass through unchanged
- Positive: Boost strength (requires gain from pool)

Used for:
- Trust-based attenuation
- Signal amplification when validated
- Gradual path drowning (competitive amplification)
- Priority adjustment

### 2. GainMinter

Mints gain to target gadgets when validated:

```typescript
Inputs:
  amount: 2.0         // How much gain to mint
  validator: true     // Must be true to mint
  target: "gadget-id" // Target gadget ID

Outputs:
  success: true/false
  receipt: Receipt object
```

**Important:** Minting gain does NOT trigger propagation unless the target was previously limited by insufficient gain.

### 3. Receipts

Every strength boost generates an immutable receipt:

```typescript
interface Receipt {
  id: string
  gadgetId: string
  amount: number
  timestamp: number
  reason?: string
}
```

## Boot System

### Boot Scripts

Networks initialize via auditable boot scripts that establish authority and initial gain:

```json
{
  "version": "1.0",
  "bootstrap": {
    "userControl": {
      "id": "user-socket",
      "initialGain": 100000,
      "authority": "root"
    },
    "primitives": {
      "source": "builtin",
      "allowed": ["add", "multiply", "transistor", "spawner"],
      "denied": ["dangerous-op"]
    },
    "initialGadgets": [
      {
        "id": "main-minter",
        "type": "gainMinter",
        "gain": 10000,
        "authority": "mint"
      }
    ]
  },
  "policy": {
    "gainConservation": "strict",
    "propagationSemantics": "argmax-strict"
  }
}
```

### Bootstrap vs Runtime

**Bootstrap Phase (one-time):**
- Creates user control socket with initial gain
- Establishes minting authorities
- Loads primitives and policies
- Generates receipts for audit

**Runtime Phase (normal operation):**
- Strict gain conservation
- Only authorized gadgets can mint
- All operations generate receipts
- No gain creation without authority

## Gain Allocation Model

### Local Gain Pools

Each gadget has a local `gainPool` that represents its capacity to amplify signals:

```typescript
interface Gadget {
  gainPool: number  // Available gain for amplification
  // ... other fields
}
```

### Gain Principles

1. **Conservation**: Gain is conserved during runtime (no creation from thin air)
2. **Authority**: Only bootstrap or authorized minters can create gain
3. **Local Consumption**: Each gadget manages its own gain pool
4. **Auditable**: All gain operations generate receipts
5. **No Automatic Propagation**: Adding gain doesn't trigger recomputation unless the gadget was gain-limited

### Propagation on Gain Change

A transistor only recomputes when gain is added IF:
1. It has current input and control signals
2. The control value is > 1.0 (requesting amplification)
3. The previous computation was limited by insufficient gain

This prevents unnecessary propagation cascades when gain is pre-allocated for future use.

### Linear Adjustment Model

The system uses additive strength adjustment:
- **Transistors** = Linear adjusters (add/subtract strength)
- **Negative control** = Attenuation (always allowed, reduces entropy)
- **Positive control** = Amplification (requires gain allocation)
- **Competition** = Highest strength wins (argmax)
- **Kill signal** = Emergency mute to 0

**Key principle**: Reducing signal strength is free (entropy reduction), but boosting requires earned/allocated gain.

## Operations Reference

### Type Predicates

| Gadget | Description | Inputs | Output | Notes |
|--------|-------------|--------|---------|-------|
| `numberP` | Check if value is number | value | boolean | |
| `stringP` | Check if value is string | value | boolean | |
| `booleanP` | Check if value is boolean | value | boolean | |
| `nullP` | Check if value is null | value | boolean | |
| `arrayP` | Check if value is array | value | boolean | |
| `objectP` | Check if value is object | value | boolean | Not array or null |
| `tagP` | Check for specific tag | value | boolean | |
| `contradictionP` | Check if contradiction | value | boolean | |
| `emptyP` | Check if list is empty | value | boolean | |
| `pairP` | Check if 2-element array | value | boolean | |

### Safe Arithmetic

All safe operations output contradictions on type errors and use MIN strength:

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `safeAdd` | Add with type checking | a, b | number or contradiction |
| `safeSubtract` | Subtract with type checking | a, b | number or contradiction |
| `safeMultiply` | Multiply with type checking | a, b | number or contradiction |
| `safeDivide` | Divide with zero check | a, b | number or contradiction |

### List Operations

| Gadget | Description | Inputs | Output | Notes |
|--------|-------------|--------|---------|-------|
| `car` | First element | list | element | Error if empty |
| `cdr` | Rest of list | list | list | Error if empty |
| `cons` | Prepend element | head, tail | list | |
| `length` | List length | list | number | |
| `pair` | Create 2-element list | first, second | [first, second] | |
| `append` | Concatenate lists | a, b | combined list | |
| `reverse` | Reverse list | list | reversed list | |
| `nth` | Get nth element | list, n | element | 0-indexed |
| `take` | Take first n | n, list | list | |
| `drop` | Drop first n | n, list | list | |

### String Operations

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `safeConcat` | Concatenate strings | a, b | string or contradiction |
| `safeStringLength` | String length | string | number or contradiction |

### Boolean Operations

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `safeAnd` | Logical AND | a, b | boolean or contradiction |
| `safeOr` | Logical OR | a, b | boolean or contradiction |
| `safeNot` | Logical NOT | value | boolean or contradiction |

### Interval Operations

Intervals are represented as pairs `[min, max]`:

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `intervalAdd` | Add intervals | a, b | [min_sum, max_sum] |
| `intervalMultiply` | Multiply intervals | a, b | [min_prod, max_prod] |

### Gain System Examples

#### Gradual Path Drowning
```typescript
// Two competing paths
pathA → transistorA → merger
pathB → transistorB → merger

// Allocate gain to pathB
transistorB.gainPool = 10000  // 1.0 worth of gain

// Boost B and/or attenuate A
transistorB.control = +3000  // Boost B
transistorA.control = -2000  // Reduce A (free)
// B's signal stronger, wins via argmax
```

#### Earned Amplification
```typescript
// Performance-based gain allocation
performance → threshold → validator
validator → gainMinter.validator
constant(0.5) → gainMinter.amount

// Transistor earns gain when performance exceeds threshold
// Can then amplify future signals
```

## Lessons Learned

### 1. Propagation Timing is Critical

**Problem:** Primitive gadgets were computing with partial inputs, leading to contradictions.

**Solution:** Only compute when ALL inputs have values with non-zero strength. This ensures gadgets see complete input sets.

### 2. Hysteresis Requires Careful Testing

**Problem:** Tests showed predicates "always returning true" because subsequent signals couldn't overcome hysteresis.

**Solution:** Use increasing strengths in tests to ensure signals propagate:
```typescript
signal1: strength 1.0
signal2: strength 1.2  // Overcomes hysteresis
signal3: strength 1.4  // Continues to overcome
```

### 3. Object Serialization Matters

**Problem:** Complex values showed as `[object Object]` in outputs.

**Solution:** Implement proper `stringify()` function that handles:
- Tagged values with special formats
- Recursive serialization
- Human-readable contradiction messages

### 4. WeakRefs Prevent Memory Leaks

Using `WeakRef` for gadget/contact references allows garbage collection of disconnected components without manual cleanup.

### 5. Type Safety Through Values

Instead of complex type systems, we use:
- Tagged values for complex types
- Predicates as gadgets for type checking
- Contradictions as first-class error values

This keeps the core simple while enabling sophisticated type checking in userspace.

## Design Principles

1. **Everything is a signal** - All data flows as signals with strength
2. **Gadgets wait for complete inputs** - No partial computations
3. **Wires are dumb** - No logic in connections
4. **Types are values** - Type information is data, not metadata
5. **Contradictions flow** - Errors are first-class values
6. **Strength decides** - Conflicts resolved by argmax
7. **Information loss tracked** - MIN strength for destructive operations
8. **Userspace complexity** - Core engine stays simple

## Usage Patterns

### Trust Building

```typescript
// TCP input starts untrusted
tcpGadget → transistor(0.1) → network

// Gradually increase trust
trustController → transistor.control
```

### Protocol Migration

```typescript
// Run old and new protocols in parallel
oldProtocol → transistor(0.8) → network
newProtocol → transistor(0.2) → network

// Gradually shift strength to new protocol
```

### Type-Safe Operations

```typescript
// Compose predicates with operations
value → numberP → gate
value → safeAdd → output
```

### Contradiction Recovery

```typescript
// Use fallback for contradictions
riskyOp → resolver → output
fallback ↗
```

### Working with Intervals

```typescript
// Intervals are just pairs
const interval1 = [2, 4]  // min: 2, max: 4
const interval2 = [3, 7]  // min: 3, max: 7

// Interval arithmetic
intervalAdd(interval1, interval2) → [5, 11]
```

## Implementation Stats

- **Core engine**: ~250 lines
- **Type system**: ~400 lines  
- **Tagged values**: ~200 lines
- **Safe primitives**: ~350 lines
- **List operations**: ~280 lines
- **Total**: <1500 lines

The entire system is designed to be hackable, extensible, and comprehensible.

## Future Directions

- **List decomposition**: Emit list elements as separate signals with decreasing strength
- **Distributed consensus** via strength voting
- **Visual editor** integration with React Flow
- **Persistence layer** for network states
- **WebRTC/WebSocket** gadgets for networking
- **Constraint solving** via bidirectional gadgets
- **Domain-specific gadgets**: Intervals, matrices, graphs

The strength-based model enables sophisticated behaviors through simple composition!