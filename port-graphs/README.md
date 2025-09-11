# Bassline Gadgets

I know this repo is called port-graphs, but alas, nothing in here directly relates to port graphs!

This is an implementation of our hyper minimal propagation network model built around **gadgets** - simple, composable units that can receive data, process it internally, and emit effects into a conceptual void.

## Core Philosophy

The beauty of this system lies in its **intentional simplicity** and **semantic openness**. We don't define how gadgets communicate with each other - instead, we provide a minimal protocol for doing useful work and leave the rest open for creative extension.

This enables powerful mechanical constructions:
- **Direct wiring** - gadgets can be connected by plugging into their events
- **Semantic routing** - build meta-gadgets that implement communication patterns like Linda-style tuplespaces
- **Composable behaviors** - complex systems emerge from simple, focused gadgets

## What is a Gadget?

A gadget is a simple stateful unit with three core capabilities:

1. **Receive** - accepts incoming data
2. **Consider** - decides what to do based on current state and incoming data  
3. **Emit** - produces effects (like state changes) into the void

```typescript
// A gadget that keeps track of the maximum value seen
const maxGadget = createGadget((current: number, incoming: number) => {
  if (incoming > current) return 'merge';
  return 'ignore';
})({
  'merge': (gadget, current, incoming) => {
    const result = Math.max(current, incoming);
    gadget.update(result);
    return changed(result);
  },
  'ignore': () => noop()
});

// Create an instance with initial value
const max = maxGadget(10);
max.receive(20); // Updates to 20, emits changed(20)
max.receive(5);  // Ignores, emits noop()
```

## Simple Gadgets, Powerful Patterns

### Set Operations
```typescript
// Union cell - merges sets, keeping all unique elements
const union = unionCell(new Set([1, 2, 3]));
union.receive(new Set([2, 3, 4])); // Results in Set([1, 2, 3, 4])

// Intersection cell - finds common elements
const intersection = intersectionCell(new Set([1, 2, 3]));
intersection.receive(new Set([2, 3, 4])); // Results in Set([2, 3])
```

### Numeric Operations
```typescript
const max = maxCell(0);
const min = minCell(100);

max.receive(50); // Updates to 50
min.receive(25); // Updates to 25
```

## Mechanical Construction: Wires

The system provides simple mechanical ways to connect gadgets:

```typescript
// Direct one-way connection
wires.directed(sourceGadget, targetGadget);

// Bidirectional connection  
wires.bi(gadgetA, gadgetB);
```

Wires work by intercepting the `emit` method and routing `changed` effects to the target gadget's `receive` method. This is pure mechanical construction - no special communication protocol needed.

## Semantic Extensions: Meta-Gadgets

The real power comes from building gadgets that implement communication patterns. For example, a Linda-style tuplespace:

```typescript
// A meta-gadget that implements semantic routing
const tuplespace = createGadget((current: Map<string, any[]>, incoming: {op: 'in' | 'out' | 'read', pattern: string, data?: any}) => {
  // Implementation would route based on semantic patterns
  return 'route';
})({
  'route': (gadget, current, incoming) => {
    // Semantic routing logic here
    return changed({routed: true});
  }
});
```

This tuplespace gadget itself is just a gadget that consumes effects from other gadgets - a meta-gadget that provides semantic meaning to the mechanical connections.

## Effects System

Gadgets communicate through a simple effect protocol:

- `changed(value)` - state was updated
- `noop()` - nothing happened  
- `contradiction(current, incoming)` - conflicting data received
- `creation(gadget)` - new gadget created

**Effects are just data** - they're partial data that results from whatever internally was happening with a particular gadget. Just like how values aren't tied to a particular interpretation, effects aren't tied to particular handlers. We don't say "this must be handled by a disk read" - we just treat it as data and don't care about it after that, because it's not important for the emitting gadget to care!

This is what makes meta-gadgets so powerful: they can consume and operate on effects just like traditional gadgets operate on their normal data.

```typescript
// A meta-gadget that filters effects
const effectFilter = createGadget((current: any[], incoming: any[]) => {
  // Process effects as regular data
  const filtered = incoming.filter(effect => effect[0] !== 'noop');
  return filtered.length > 0 ? 'merge' : 'ignore';
})({
  'merge': (gadget, current, incoming) => {
    const result = [...current, ...incoming];
    gadget.update(result);
    return changed(result);
  },
  'ignore': () => noop()
});
```

The effect system is intentionally minimal and extensible. You can define your own effects and wire gadgets to respond to them however you want.

## Why This Matters

This design enables:

1. **Composability** - complex behaviors from simple, focused gadgets
2. **Extensibility** - new communication patterns without changing core protocol
3. **Mechanical Construction** - direct wiring without semantic coupling
4. **Semantic Freedom** - implement any communication pattern as a gadget
5. **Type Safety** - full TypeScript support with inference

The system doesn't prescribe how gadgets should work together - it just provides the minimal tools needed to build whatever communication patterns you need.