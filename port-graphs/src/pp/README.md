# Propagation Network Implementation

## What We Built

A minimal propagation network system in ~150 lines based on the Apply/Consider/Act protocol.

## Core Components

### 1. Protocol (`core.ts` - 32 lines)
```typescript
protocol(apply, consider, act)
```
The universal three-step pattern. Everything follows this.

### 2. Patterns (`patterns.ts` - ~100 lines)
- `cell()` - Stateful accumulation with merge functions
- `fn()` - Stateless transformation  
- Injectable actions for flexibility
- Helper actions (log, direct, compose, batch, etc.)

### 3. EventfulGadget (`event-gadget.ts` - ~60 lines)
```typescript
const sensor = new EventfulGadget<number>('sensor')
  .use(fn(transform, emitEvent('data')));
```
Common pattern combining Gadget + EventTarget.

### 4. Pool (`pool.ts` - ~150 lines)
Self-organizing topology through semantic assertions:
```typescript
pool.receive(assert.provides('sensor', 'temperature', sensor));
pool.receive(assert.needs('display', 'temperature', display));
// Pool automatically wires them
```

## Ergonomics Assessment

### ✅ What Works Well

1. **Minimal Surface Area** - Just 3 concepts: protocol, gadget, action
2. **Composable** - Mix and match patterns freely
3. **Type Safe** - Full TypeScript inference
4. **No Magic** - Everything explicit and traceable
5. **Framework Agnostic** - Not tied to any specific runtime

### 🤔 Current Limitations

1. **Manual Wiring** - Still need to call wireEvents() or use Pool
2. **EventTarget Dependency** - Ties us to browser/Node 15.4+
3. **Verbose for Simple Cases** - Need to create gadget, use protocol, wire

### Example Usage

```typescript
// Create gadgets
const sensor = new EventfulGadget<number>('sensor')
  .use(fn(
    (reading: number) => reading * 2,
    emitEvent('data')
  ));

const display = new EventfulGadget<number>('display')
  .use(cell(
    (_old, value) => value,
    0,
    (value) => console.log(value)
  ));

// Wire them
wireEvents(sensor, display, 'data');

// Use
sensor.receive(10); // Displays: 20
```

## Next Steps for Better Ergonomics

1. **Builder Pattern**
```typescript
const network = Network.create()
  .add('sensor', fn(x => x * 2))
  .add('display', cell(max, 0))
  .wire('sensor', 'display')
  .build();
```

2. **React Hooks**
```typescript
const useGadget = (protocol) => {
  const [state, setState] = useState();
  const gadget = useMemo(() => 
    new EventfulGadget().use(protocol), []);
  // ...
};
```

3. **Declarative Syntax**
```typescript
const network = describe({
  sensor: fn(x => x * 2),
  display: cell(max, 0),
  wiring: [['sensor', 'display']]
});
```

## Summary

The core is solid and minimal. The ergonomics are reasonable for a low-level API but could benefit from higher-level abstractions for common use cases. The injectable actions pattern provides excellent flexibility without bloating the core.