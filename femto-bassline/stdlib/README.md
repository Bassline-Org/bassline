# Standard Library

The Femto-Bassline standard library provides core gadgets and utilities for building propagation networks.

## Overview

The standard library is divided into two main categories:

1. **Shims**: Gadgets that transform or observe propagation without changing the underlying computation
2. **Primitives**: Core computational gadgets for basic operations

## Shim Gadgets

Shims are "transparent" gadgets that sit in the propagation path to provide cross-cutting concerns like observability, flow control, and validation. They preserve the identity of pulses passing through.

### Tap (`shims/tap.ts`)

**Purpose**: Non-intrusive observation of values flowing through wires.

**Key Features**:
- Preserves pulse identity (pass-through)
- Multiple output targets (console, memory, callback)
- Configurable filtering and formatting
- Statistics tracking

**Configuration**:
```typescript
const tap = createTapGadget('my-tap', {
  target: 'console',      // 'console' | 'memory' | 'callback'
  filter: {
    minInterval: 100,     // Minimum ms between taps
    maxCount: 1000,       // Maximum taps to record
    predicate: (v) => v > 0  // Custom filter function
  },
  format: {
    includeTimestamp: true,
    includePulseId: true,
    label: 'sensor-data'
  }
});
```

**Use Cases**:
- Debugging data flow
- Performance monitoring
- Event logging
- Test assertions

### Rate Limit (`shims/rate-limit.ts`)

**Purpose**: Throttle propagation using token bucket algorithm.

**Key Features**:
- Token bucket rate limiting
- Lattice-based composition (takes most restrictive)
- Queue or drop on limit
- Backpressure signaling

**Configuration**:
```typescript
const limiter = createRateLimitGadget('api-limiter', {
  rps: 100,               // Requests per second
  burst: 10,              // Burst capacity
  onLimit: 'queue',       // 'drop' | 'queue' | 'error'
  queue: {
    maxSize: 1000,
    timeout: 5000         // Queue timeout in ms
  },
  emitBackpressure: true
});
```

**Lattice Composition**:
When multiple rate limits apply, they compose by taking the minimum (most restrictive):
```typescript
// RateLimit lattice ensures deterministic composition
{ rps: 100, burst: 10 } ⊔ { rps: 50, burst: 20 } = { rps: 50, burst: 10 }
```

**Use Cases**:
- API rate limiting
- Resource protection
- Fair scheduling
- Load balancing

### Credit Gate (`shims/credit-gate.ts`)

**Purpose**: Credit-based flow control for deterministic scheduling.

**Key Features**:
- Credit consumption and replenishment
- Demand signaling for scheduler integration
- Queue management with FIFO/LIFO
- Bounded memory guarantees

**Configuration**:
```typescript
const gate = createCreditGateGadget('scheduler-gate', {
  initialCredits: 1,
  maxCredits: 10,
  creditsPerItem: 1,
  onNoCredits: 'queue',    // 'queue' | 'drop' | 'error'
  queue: {
    maxSize: 100,
    fifo: true              // FIFO vs LIFO
  },
  autoDemand: true          // Auto signal demand
});
```

**Scheduler Integration**:
```typescript
// Receive credits from scheduler
gate.receiveCredits(5);

// Listen for demand signals
gate.onDemand((needed) => {
  scheduler.requestCredits(needed);
});
```

**Use Cases**:
- Coordinated scheduling
- Resource allocation
- Priority queuing
- Batch processing

## Primitive Gadgets

Primitives provide fundamental computational operations. They're the building blocks for more complex behaviors.

### Math Primitives (`primitives/math.ts`)

#### Binary Operations

**Gadgets**: add, subtract, multiply, divide, modulo, power

**Example**:
```typescript
const adder = createAddGadget('sum');
// Pins: a (in), b (in), result (out)
```

#### Unary Operations

**Gadgets**: negate, abs, sqrt, floor, ceil, round

**Example**:
```typescript
const absolute = createAbsGadget('magnitude');
// Pins: value (in), result (out)
```

#### Comparison Operations

**Gadgets**: eq, neq, lt, lte, gt, gte

**Example**:
```typescript
const compare = createLessThanGadget('threshold-check');
// Pins: a (in), b (in), result (out boolean)
```

#### Accumulator Operations (Stateful)

**Gadgets**: sum, product, min, max, count

**Features**:
- Maintains internal state
- Reset signal support
- State output pin

**Example**:
```typescript
const accumulator = createSumGadget('total');
// Pins: value (in), reset (pulse in), result (out), state (out)
```

## Pinout Definitions

All gadgets declare their pin interfaces using standardized pinouts:

### Pin Kinds

- `ValueIn`: Accepts continuous values
- `ValueOut`: Emits continuous values  
- `PulseIn`: Accepts discrete events
- `PulseOut`: Emits discrete events
- `EventOut`: Emits notifications (non-propagating)

### Pin Properties

- `required`: Whether the pin must be connected
- `domain`: Semantic domain (e.g., 'number', 'scheduler', 'metrics')
- `lattice`: Associated lattice for composition

## Traits System

All gadgets declare computational traits with evidence:

### Common Traits

- **pure**: No side effects, same input → same output
- **deterministic**: Predictable behavior
- **bounded-memory**: Memory usage is bounded
- **sched:deterministic**: Compatible with deterministic scheduling

### Evidence Types

- `declared`: Asserted by implementation
- `verified`: Formally verified
- `measured`: Empirically measured
- `derived`: Inferred from composition

## Design Principles

### 1. Composability

All shims are designed to compose cleanly:
- Preserve pulse identity
- Use lattices for overlapping configurations
- Support chaining without interference

### 2. Performance

- Bounded memory usage
- Efficient token bucket algorithms
- Queue management with configurable limits
- Lazy evaluation where possible

### 3. Observability

- Statistics tracking
- Event emission
- Configurable verbosity
- Debug-friendly formatting

### 4. Determinism

- Reproducible behavior
- No hidden global state
- Explicit configuration
- Lattice-based composition

## Usage Examples

### Building a Rate-Limited API

```typescript
// Create a pipeline with observation and rate limiting
const pipeline = compose(
  createTapGadget('api-monitor', { target: 'console' }),
  createRateLimitGadget('api-throttle', { rps: 100 }),
  createCreditGateGadget('api-scheduler', { maxCredits: 10 })
);
```

### Creating a Calculation Network

```typescript
// Sum of squares: (a² + b²)
const a_squared = createMultiplyGadget('a_sq');
const b_squared = createMultiplyGadget('b_sq');
const sum = createAddGadget('sum_squares');

// Wire them together
connect(a, a_squared.pins.a);
connect(a, a_squared.pins.b);
connect(b, b_squared.pins.a);
connect(b, b_squared.pins.b);
connect(a_squared.pins.result, sum.pins.a);
connect(b_squared.pins.result, sum.pins.b);
```

### Monitoring with Accumulation

```typescript
// Track running statistics
const counter = createCountGadget('event-count');
const maxSeen = createMaxGadget('peak-value');
const tap = createTapGadget('stats-tap', {
  format: { label: 'Statistics' }
});

// Connect monitoring
connect(source, counter.pins.value);
connect(source, maxSeen.pins.value);
connect(maxSeen.pins.state, tap.pins.in);
```

## Testing

All standard library components include:
- Unit tests for core functionality
- Property-based tests for lattice laws
- Integration tests for composition
- Performance benchmarks

Run tests with:
```bash
pnpm test stdlib
```

## Future Additions

Planned additions to the standard library:

### Shims
- **Retry**: Automatic retry with backoff
- **Cache**: Memoization and caching
- **Validate**: Schema validation
- **Transform**: Data transformation

### Primitives
- **String**: Concatenation, splitting, regex
- **Logic**: AND, OR, NOT, XOR
- **Collection**: Map, filter, reduce
- **Time**: Delays, timeouts, scheduling

## Contributing

When adding new gadgets:

1. Follow the established patterns
2. Include comprehensive TypeScript types
3. Add Zod schemas for runtime validation
4. Implement proper trait declarations
5. Write thorough documentation
6. Add unit and property tests
7. Consider lattice composition
8. Ensure bounded memory usage