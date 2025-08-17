# Femto-Bassline

Ultra-minimal TypeScript implementation of the Bassline propagation runtime with gadgets, boards, binders, and aspects.

## Architecture Overview

Femto-Bassline implements a **constraint-driven propagation system** where:
- **Gadgets** are pure reactive machines that propagate values
- **Boards** are gadgets with slots and controlled mutation via binders
- **Binders** are the sole authority for structural changes
- **Aspects** provide opt-in extensibility without polluting core semantics
- **Lattices** ensure deterministic composition and convergence

### Key Principles

1. **IR First, Runtime Second**: All operations work on desired state (BoardIR), runtime is a projection
2. **Single-Writer Binder**: Structural mutations are serialized, evaluation is concurrent
3. **Explicit Everything**: No hidden hooks or magic, all aspects become visible shim gadgets
4. **Lattice Composition**: All overlapping controls join deterministically
5. **Content Addressing**: Stable hashing enables deterministic re-runs and caching

## Project Structure

```
femto-bassline/
├── core/           # Pure types, lattices, graph IR, provenance
├── runtime/        # Binder, evaluation loop, aspect lowering
├── stdlib/         # Standard shims and primitive gadgets
├── rewriters/      # Graph transformation passes
├── tests/          # Comprehensive test suite
└── examples/       # Usage examples and patterns
```

## Core Concepts

### Gadgets
The fundamental building blocks - pure reactive machines that:
- Expose boundary pins (inputs/outputs)
- Contain internal contacts and wiring
- Never self-mutate (no structural changes)
- Always propagate values forward deterministically

### Boards
Special gadgets that support structural mutation and initialization:
- Expose pins and slots for mounting gadgets
- Contain a binder gadget that mediates all changes
- Support runtime evolution via boot scripts
- Can host scheduler boards to alter propagation dynamics

### Binders
Controllers that mediate all structural changes:
- Accept boot scripts and structural update commands
- Enforce validation, policies, and traits
- Install aspects and weavers
- Emit receipts with full provenance

### Aspects
Opt-in extension mechanism with five scopes:
1. **Wire Aspects**: Transform data between contacts
2. **Pin Aspects**: Filter/validate at port boundaries  
3. **Slot Aspects**: Wrap gadgets with extra behavior
4. **Board Aspects**: Apply policies across all children
5. **Binder Aspects**: Extend control plane logic

### Lattices
Mathematical foundation for deterministic composition:
- Define partial order and join operations
- Enable order-independent convergence
- Power interrupt composition and control flow
- Ensure system always reaches consistent state

## Type Safety with Zod

All core types are defined using Zod schemas for:
- Runtime validation of binder plans
- Schema validation for aspect parameters
- Domain validation on pins
- Safe deserialization of boards/gadgets
- IR integrity checking

## Key Design Decisions

### Why Gadgets?
Unlike traditional dataflow, gadgets support:
- Bidirectional constraint propagation
- Natural cycles without infinite loops
- Always-on, long-running computation
- Partial information and redundancy

### Why Binders?
Single point of mutation ensures:
- Full provenance tracking
- Atomic structural changes
- Policy enforcement
- Predictable system evolution

### Why Aspects?
Orthogonal concerns without core pollution:
- Scheduling, logging, monitoring as add-ons
- User-extensible without forking
- Composable via deterministic ordering
- Visible as concrete shim gadgets

## Comparison to Traditional Systems

| Feature | Traditional Dataflow | Femto-Bassline |
|---------|---------------------|----------------|
| Execution Model | Linear, token passing | Constraint-driven propagation |
| Cycles | Avoided or error | First-class, convergent |
| Mutation | Anywhere | Only through binder |
| Extension | Modify core | Aspects + weavers |
| Distribution | Difficult | Native via lattices |
| Visual Representation | Overlays execution | IS the execution |

## Getting Started

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck
```

## Common Pitfalls to Avoid

1. **Hidden privilege**: Aspects are data, capabilities are wired visibly
2. **Global clocks**: Use monotone lattices, not sync points
3. **Mixing structure & evaluation**: Gadgets compute, binders mutate
4. **Unbounded memory**: Use bounded buffers with drop policies
5. **Ambiguous composition**: Canonical orderKey and lattice joins

## Subtle Design Choices

- **Two views**: IR view (wires with aspects) and Realized view (gadget graph)
- **Content addressing**: Hash normalized specs for determinism
- **Join-first control**: Overlapping controls join, never overwrite
- **Pulse identity**: Preserved across distribution for dedup/merge

## Roadmap

### Phase 1: Core Foundation ✓
- [x] Type system with Zod
- [x] Project structure
- [ ] Lattice abstractions
- [ ] Graph IR definitions

### Phase 2: Runtime
- [ ] Binder implementation
- [ ] Aspect system
- [ ] Evaluation loop

### Phase 3: Standard Library
- [ ] Core shims (Tap, RateLimit, CreditGate)
- [ ] Primitive gadgets (math, logic, string)

### Phase 4: Rewriters
- [ ] Scheduler weaver
- [ ] Adapter inference
- [ ] Baking/compilation

## License

MIT