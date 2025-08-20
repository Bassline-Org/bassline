# Atto-Bassline System Specification

## Overview

Atto-Bassline is an ultra-minimal strength-based signal propagation network. It models computation as signals flowing through a network of gadgets, where each signal carries both a value and a strength representing confidence or refinement level.

## Core Concepts

### 1. Signals

Every piece of information is a signal with two components:

```typescript
interface Signal {
  value: Value      // The actual data
  strength: number  // Confidence/refinement level (0.0 to 1.0+)
}
```

**Strength represents:**
- Confidence in the value
- Refinement level (more specific = higher strength)
- Trust in the source
- Priority in conflict resolution

### 2. Gadgets

Gadgets are the fundamental processing units:

```typescript
interface Gadget {
  id: string
  contacts: Map<string, Contact>  // Connection points
  gadgets: Map<string, Gadget>    // Sub-gadgets
  compute?: Function               // Optional computation
}
```

**Gadgets are always active** - they respond immediately when signals arrive at their contacts.

### 3. Contacts

Contacts are connection points on gadgets:

```typescript
interface Contact {
  id: string
  signal: Signal
  gadget: WeakRef<Gadget>         // Owning gadget
  sources: Set<WeakRef<Contact>>  // Input connections
  targets: Set<WeakRef<Contact>>  // Output connections
}
```

### 4. Wires

Wires are dumb connections between contacts. They simply forward signals without modification. All signal manipulation happens in gadgets.

## Propagation Rules

### Argmax with Hysteresis

When multiple signals arrive at a contact, the strongest one wins:

```
if (newSignal.strength > currentSignal.strength + HYSTERESIS) {
  currentSignal = newSignal
}
```

The hysteresis margin (δ = 0.01) prevents oscillation when signals have nearly equal strength.

### Information Loss Principle

Primitive gadgets that destroy information (like addition) output the **minimum** strength of their inputs:

```
add(a: 0.9, b: 0.4) → output: 0.4
```

This ensures confidence naturally decreases through computation chains.

## Type System

### Value Types

Values are JSON-compatible:

```typescript
type Value = 
  | null
  | boolean
  | number
  | string
  | Value[]                    // Arrays
  | { [key: string]: Value }   // Objects
```

### Tagged Values

Complex types use tagged values:

```typescript
{tag: "interval", value: {min: 3, max: 7}}
{tag: "complex", value: {real: 3, imag: 4}}
{tag: "contradiction", value: {reason: "...", sources: [...]}}
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

## Special Gadgets

### 1. Transistor

Attenuates signal strength by a control factor:

```
Input (strength: 0.8) × Control (0.5) → Output (strength: 0.4)
```

Used for:
- Trust-based attenuation
- Signal decay over distance
- Priority adjustment

### 2. Modulator

Boosts signal strength (requires receipts for audit):

```
Input (strength: 0.3) + Boost (0.4) → Output (strength: 0.7)
```

Used for:
- Amplifying trusted sources
- Injecting external evidence
- Overriding weak signals

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

## Operations Reference

### Type Predicates

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `numberP` | Check if value is number | value | boolean |
| `stringP` | Check if value is string | value | boolean |
| `booleanP` | Check if value is boolean | value | boolean |
| `nullP` | Check if value is null | value | boolean |
| `arrayP` | Check if value is array | value | boolean |
| `objectP` | Check if value is object | value | boolean |
| `tagP` | Check for specific tag | value | boolean |
| `contradictionP` | Check if contradiction | value | boolean |
| `emptyP` | Check if list is empty | value | boolean |
| `pairP` | Check if 2-element array | value | boolean |

### Safe Arithmetic

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `safeAdd` | Add with type checking | a, b | number or contradiction |
| `safeSubtract` | Subtract with type checking | a, b | number or contradiction |
| `safeMultiply` | Multiply with type checking | a, b | number or contradiction |
| `safeDivide` | Divide with zero check | a, b | number or contradiction |

### List Operations

| Gadget | Description | Inputs | Output |
|--------|-------------|--------|---------|
| `car` | First element | list | element |
| `cdr` | Rest of list | list | list |
| `cons` | Prepend element | head, tail | list |
| `length` | List length | list | number |
| `pair` | Create 2-element list | first, second | [first, second] |
| `append` | Concatenate lists | a, b | combined list |
| `reverse` | Reverse list | list | reversed list |
| `nth` | Get nth element | list, n | element |
| `take` | Take first n | n, list | list |
| `drop` | Drop first n | n, list | list |

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

## Design Principles

1. **Everything is a signal** - All data flows as signals with strength
2. **Gadgets are always active** - Immediate response to inputs
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

## Implementation Stats

- **Core engine**: ~250 lines
- **Type system**: ~400 lines
- **Total**: <1000 lines

The entire system is designed to be hackable, extensible, and comprehensible.

## Future Directions

- **Distributed consensus** via strength voting
- **Visual editor** integration
- **Persistence layer** for network states
- **WebRTC/WebSocket** gadgets for networking
- **Constraint solving** via bidirectional gadgets

The strength-based model enables sophisticated behaviors through simple composition!