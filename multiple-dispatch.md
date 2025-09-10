# Propagator Network Effect System Design

## Core Concepts

### Gadgets as Reduction Functions with Multimethod Dispatch
Every gadget is fundamentally a reduction function `(acc, curr) → nextAcc` that:
1. **Reduces** incoming values (whether data or effects) using multimethod dispatch
2. **Discriminates** on ANY function of accumulated state + input to produce dispatch values
3. **Returns** a map of effects (just a plain map of values to bubble up)

ALL gadgets follow this pattern - there's no distinction between "normal" gadgets and "effect handlers":
- A cell gadget: `(currentValue, newData) → {nextValue, effectMap}`
- An effect handler: `(currentState, childEffects) → {nextState, effectMap}`
- A pool gadget: `(assertions, newAssertions) → {merged, wiringEffectMap}`

They're all just reduction functions over streams of partial information. The only difference is what kind of values they're reducing - but the mechanism is identical. The effect map is just a map - nothing special about it.

The dispatch function determines what "namespace" of values you're operating in:

```typescript
// Cell: reduction function over data values
const cellGadget = defMulti((acc, curr) => {
  if (acc === Nothing) return 'init';
  if (curr === Contradiction) return 'contradiction';
  return 'merge';
});

// Effect handler: reduction function over effect values
const effectHandler = defMulti((acc, effects) => {
  // Still just (acc, curr) → dispatch, but curr happens to be effects
  return [acc.id, effects[0]];  // Compound dispatch value
});

// Router: reduction that discriminates on computed properties
const router = defMulti((acc, effects) => {
  if (hierarchy.isa(acc.id, 'critical-system')) {
    return 'high-priority';
  }
  return 'normal';
});

// All follow the same pattern: (acc, curr) → dispatch → nextAcc + effects
```

## Effect Bubbling Architecture

### Hierarchical Effect Processing
Effects bubble up through parent-child relationships:

```typescript
// Level 0: Base computation gadget
const sensor = {
  behavior: defMulti((curr, reading) => 
    reading > 100 ? 'alert' : 'normal'
  )
};

sensor.behavior.defMethods({
  'alert': (_, reading) => ({ 'temperature-spike': reading }),
  'normal': (_, reading) => ({ 'temperature': reading })
});

// Level 1: Monitoring gadget (also a reduction function!)
// Reduces child effects just like any gadget reduces values
const monitor = {
  children: [sensor1, sensor2, sensor3],
  behavior: defMulti((accState, childEffects) => {
    // This is just reduction! (acc, curr) → dispatch value
    const hasSpike = childEffects.some(e => e[0] === 'temperature-spike');
    return hasSpike ? 'emergency' : 'normal';
  })
};

monitor.behavior.defMethods({
  'emergency': (acc, effects) => ({
    // Reduction produces effect map
    'shutdown-system': true,
    'alert-operator': effects
  }),
  'normal': (acc, effects) => {
    // Reduce effects to summary (map/filter/fold are all reductions!)
    const avgTemp = computeAverage(effects);
    return { 'average-temperature': avgTemp };
  }
});
```

### Effect Flow
```
sensor emits {'temperature-spike': 105}
    ↑ (bubbles to parent)
monitor receives child effects, emits {'shutdown-system': true}
    ↑ (bubbles to parent)
factory controller receives effects, emits {'execute-shutdown': true}
    ↑ (bubbles to runtime)
Runtime handles top-level effects (IF EXPLICITLY BOUND, OTHERWISE THEY ARE JUST LOGGED AND IGNORED)
```

## Key Properties

### 1. No Ambient Communication
Gadgets cannot:
- Know who their parents are
- Know who their children are  
- Directly communicate with other gadgets
- Wire themselves to anything

They can only:
- Process inputs
- Return effects

### 2. Effects as Maps
Effects are just plain maps - nothing special:
```typescript
type Effects = Map<string, any>
// or in JS: just a plain object {}
```

No special effect types, just maps of values that bubble up

### 3. Topology as Emergent Effect
Topology is not primitive - it emerges from effects handled at the meta-level:
- Wiring is just another effect type that bubbles up
- Meta-level gadgets (or host runtime) interpret wiring effects
- Semantic wiring through wants/provides declarations (like Linda tuplespaces)
- Pool gadgets demonstrate this: topology emerges from matching semantic assertions

## Integration with Multimethods

### Dispatch Chain
Each level in the hierarchy is a multimethod dispatch:

```typescript
// Child gadget dispatches on its input
childGadget.dispatch(current, input) → 'some-case'
childGadget.methods['some-case']() → {'effect1': value1, 'effect2': value2}

// Parent gadget dispatches on child effects  
parentGadget.dispatch(current, {'effect1': value1, 'effect2': value2}) → 'handle-effects'
parentGadget.methods['handle-effects']() → {'parent-effect': processedValue}

// Grandparent dispatches on parent effects
// ... and so on
```

## Common Patterns

### Scheduling as Reduction
```typescript
// Scheduler is just a reduction function with stateful accumulator!
const batchScheduler = defMulti((buffer, childEffects) => {
  // Reduction discriminator: (acc, curr) → dispatch
  return buffer.length + childEffects.length >= 10 ? 'flush' : 'accumulate';
});

batchScheduler.defMethods({
  'flush': (buffer, effects) => {
    // Reduce accumulated buffer + new effects to batch effect
    const allEffects = [...buffer, ...effects];
    return { 'batch': allEffects };
  },
  'accumulate': (buffer, effects) => {
    // Stateful reduction - accumulate for later
    buffer.push(...effects);
    return {};  // Empty map - no effects yet
  }
});
```

### Effect Routing
```typescript
const router = defMulti((_, effects) => {
  // Dispatch on effect patterns
  if (effects.some(e => e[0] === 'critical')) return 'high-priority';
  if (effects.length > 100) return 'batch-process';
  return 'normal';
});
```

### Cross-Runtime Communication
```typescript
const networkBridge = defMulti((_, effects) => {
  if (effects.some(e => e[0] === 'remote')) return 'serialize-and-send';
  return 'local';
});

networkBridge.defMethods({
  'serialize-and-send': (_, effects) => {
    return { 'send-wire': { target: 'runtime-b', data: serialize(effects) } };
  }
});
```

### Semantic Wiring via Pool Pattern
```typescript
// Gadgets emit wants/provides as effects
const tempSensor = defMulti((curr, _) => 'normal');
tempSensor.defMethods({
  'normal': () => ({
    'provides': { type: 'temperature', id: 'sensor-123' },
    'temperature': 22.5
  })
});

const display = defMulti((curr, _) => 'waiting');
display.defMethods({
  'waiting': () => ({ 'wants': { type: 'temperature', id: 'display-456' } })
});

// Pool gadget at meta-level matches and creates wiring effects
const pool = defMulti((assertions, childEffects) => {
  // Accumulate wants/provides assertions
  const updated = mergeAssertions(assertions, childEffects);
  const matches = findMatches(updated);
  return matches.length > 0 ? 'wire' : 'accumulate';
});

pool.defMethods({
  'wire': (assertions, _, matches) => {
    // Emit wiring effects as a map
    const wiring = {};
    matches.forEach(([provider, consumer], i) => {
      wiring[`wire-${i}`] = { from: provider, to: consumer };
    });
    return wiring;
  },
  'accumulate': (assertions, effects) => {
    // Just accumulate, no wiring yet
    return {};  // Empty map
  }
});
```

## Transducer Composition

Since all gadgets are reduction functions, they naturally compose like transducers:

```typescript
// Transducer: a higher-order reduction
const map = (f) => (reducer) => (acc, curr) => 
  reducer(acc, f(curr));

const filter = (pred) => (reducer) => (acc, curr) =>
  pred(curr) ? reducer(acc, curr) : acc;

// Gadgets as transducers
const tempFilter = filter(e => 'temperature' in e);
const tempMap = map(e => ({ 'celsius': (e.temperature - 32) * 5/9 }));

// Compose gadget behaviors
const fahrenheitToCelsius = compose(
  tempFilter,
  tempMap
);

// Apply to effect stream
const processedEffects = fahrenheitToCelsius(baseReducer);
```

This means gadgets can be:
- Composed without special machinery
- Optimized through transducer fusion
- Parallelized through reduction strategies
- Tested as pure functions

## Implementation Strategy

### Phase 1: Core Reduction Gadgets
1. Implement gadget as reduction function with multimethod dispatch
2. Basic effect return values as reduction output
3. Simple parent-child relationships as reduction chains

### Phase 2: Effect Bubbling
1. Parent gadgets as reducers over child effect streams
2. Effect transformation as transducer patterns
3. Top-level runtime as final reducer

### Phase 3: Advanced Patterns
1. Transducer composition for complex behaviors
2. Parallel reduction strategies
3. Cross-runtime communication via serialized reductions
4. Pool-based dynamic topology through assertion reduction

## Benefits

1. **Unified Reduction Model**: Everything is `(acc, curr) → nextAcc + effects`
2. **No Special Cases**: Data processing and effect handling use identical reduction semantics
3. **Transducer Composition**: Since all gadgets are reductions, they compose like transducers
4. **Local Reasoning**: Each gadget only knows its accumulator and current input
5. **Composable**: Stack behaviors through parent-child relationships (reduction chains)
6. **Extensible**: New effect types are just new values to reduce over

## Summary

The system achieves a remarkable simplification:
- ALL gadgets are reduction functions: `(acc, curr) → nextAcc + effectMap`
- Effects are just maps - plain objects with key-value pairs
- Effect handlers are just gadgets reducing over effect maps
- Effects bubble up through parent relationships (reduction chains)
- Topology emerges from effects, not primitive wiring
- Semantic wiring via wants/provides patterns (Linda-style)
- No ambient communication or global coordination
- Everything is just values (as maps) flowing through reduction + dispatch

The key insight: there's no distinction between "data processing" and "effect handling" - they're both just reduction over streams of partial information. Map, filter, fold, effect routing, scheduling, wiring - all reductions with different dispatch strategies. And the "effects" are just maps - nothing magic, just `{key: value}` objects.