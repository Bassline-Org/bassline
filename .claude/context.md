# Context: Gadget System Learnings

## Relations Module - Type-Safe Gadget Wiring

### What We Built
- **`combiner`** - Builder pattern for wiring gadgets with compile-time type safety
- **`extract`** - Extract specific effect field from source to target
- **`transform`** - Extract, transform, then forward to target
- **`relations`** - Wire multiple relations with single cleanup

### Key TypeScript Discoveries

#### 1. Overloading Must Constrain Generics
**Wrong approach:**
```typescript
// All overloads accept any Gadget<S> - no actual constraints!
wire<S>(source: Gadget<S> & Tappable<S>): ...
wire<S, F>(source: Gadget<S> & Tappable<S>, field: F): ...
```

**Correct approach:**
```typescript
// First overload constrains S to have correct effect type
wire<S extends Effects<{ changed: InputOf<Target>[K] }>>(
  source: Gadget<S> & Tappable<S>
): ...

// Other overloads have different constraints
wire<S, F extends keyof EffectsOf<S>>(
  source: Gadget<S> & Tappable<S>,
  field: F
): ...
```

#### 2. Avoid `any` - It Breaks Inference
- Using `Gadget<any>` prevents TypeScript from inferring the actual spec
- Causes variance issues: `update(state: unknown)` vs `update(state: number)`
- Solution: Use proper generics with constraints

#### 3. Type Helpers for Cleaner Code
```typescript
type AvailableKeys<Target, Wired> = Exclude<keyof InputOf<Target>, Wired>;
// Much cleaner than repeating Exclude<keyof InputOf<Target>, Wired> everywhere
```

### Builder Pattern Implementation
```typescript
combiner(sumFn)
  .wire('x', numberGadget)      // ✅ Type-safe
  .wire('x', stringGadget)      // ❌ Compile error!
  .wire('y', gadget, 'field')   // Extract specific field
  .wire('z', gadget, 'field', transform)  // Transform
  .build();
```

### Critical Lessons

1. **TypeScript overloads need different constraints** - Otherwise they're pointless
2. **Generic constraints are how you get type safety** - `S extends Effects<...>`
3. **Builder patterns track state at type level** - `Wired` accumulates wired keys
4. **Simplify when stuck** - We tried complex conditional types, but simple overloads worked better
5. **Test your types!** - Create invalid cases to verify constraints actually work

### Files
- `/port-graphs/src/relations/index.ts` - Relations module with combiner
- `/port-graphs/src/relations/relations.test.ts` - Comprehensive tests

## Notebook System Work

### What We Built
- `useGadgetMap` hook - transforms gadget map to `{key: {state, send, gadget}}`
- `GadgetDisplay<S>` - display component generic over spec, not gadget
- Notebook demo at `/notebook-demo` with pattern examples

### Key Discoveries
- **No widget abstraction needed** - gadgets + components are sufficient
- **Spec is the type** - `GadgetDisplay<S>` takes `Gadget<S> & Tappable<S>`
- **Patterns emerge from composition** - bidirectional sync, aggregation, shared state

### Important Code
```typescript
// useGadgetMap - clean multi-gadget access
const g = useGadgetMap({a: gadgetA, b: gadgetB});
// g.a.state, g.a.send, g.a.gadget

// GadgetDisplay - generic over spec
function GadgetDisplay<S>({gadget}: {gadget: Gadget<S> & Tappable<S>})
```

### Files
- `/port-graphs-react/src/useGadgetMap.ts` - the hook
- `/apps/web/app/notebook/` - simplified display components
- `/apps/web/app/routes/notebook-demo.tsx` - pattern gallery