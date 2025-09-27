# Context: Notebook System Work

## What We Built
- `useGadgetMap` hook - transforms gadget map to `{key: {state, send, gadget}}`
- `GadgetDisplay<S>` - display component generic over spec, not gadget
- Notebook demo at `/notebook-demo` with pattern examples

## Key Discoveries
- **No widget abstraction needed** - gadgets + components are sufficient
- **Spec is the type** - `GadgetDisplay<S>` takes `Gadget<S> & Tappable<S>`
- **Patterns emerge from composition** - bidirectional sync, aggregation, shared state

## Important Code
```typescript
// useGadgetMap - clean multi-gadget access
const g = useGadgetMap({a: gadgetA, b: gadgetB});
// g.a.state, g.a.send, g.a.gadget

// GadgetDisplay - generic over spec
function GadgetDisplay<S>({gadget}: {gadget: Gadget<S> & Tappable<S>})
```

## Lessons
- **Never use `any`** - forced correct type discovery
- **Fire-and-forget works in React** - semantic openness validated
- **Gadgets are the framework** - don't build on top, discover patterns

## Files
- `/port-graphs-react/src/useGadgetMap.ts` - the hook
- `/apps/web/app/notebook/` - simplified display components
- `/apps/web/app/routes/notebook-demo.tsx` - pattern gallery