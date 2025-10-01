# CSP Language (Constraint Satisfaction Problem)

**Purpose**: Express constraint satisfaction problems using domain vocabulary (variables, constraints, relationships)

**Compilation Target**: Network DSL

## Vocabulary

### Commands (Input)

#### `variable` - Define a variable type
```typescript
{
  variable: {
    name: string;           // Variable type name
    domain: () => Gadget;  // Factory for domain gadget (usually intersection cell)
  }
}
```

#### `create` - Instantiate a variable
```typescript
{
  create: {
    id: string;    // Variable instance ID
    type: string;  // Variable type name
    domain?: any;  // Optional initial domain
  }
}
```

#### `relate` - Declare constraint relationship
```typescript
{
  relate: {
    vars: string[];                    // Variable IDs to constrain
    constraint: (...domains: any[]) => any[];  // Constraint function
  }
}
```

### Events (Effects)

- `variableDefined: { name: string }` - Variable type registered
- `created: { id: string }` - Variable instance created
- `related: { vars: string[] }` - Constraint established
- `error: { type: string; details: string }` - Operation failed

## Semantics

### Variable Definition
When you send `{ variable: { name, domain }}`:
1. Registers factory in definitions table
2. Emits `{ variableDefined: { name }}`

### Variable Creation
When you send `{ create: { id, type, domain }}`:
1. Looks up type in definitions
2. Creates instance using domain factory
3. If domain provided, sends to instance
4. Emits `{ created: { id }}`

### Relationship Declaration
When you send `{ relate: { vars, constraint }}`:
1. Validates all variables exist
2. Creates propagator gadget that:
   - Taps all variable changes
   - Applies constraint function
   - Sends refined domains back to variables
3. Emits `{ related: { vars }}`

## Compilation

CSP commands compile to Network DSL operations:

| CSP Command | Network Compilation |
|-------------|---------------------|
| `variable` | `define` - Register domain factory |
| `create` | `spawn` - Instantiate variable + optional `receive` |
| `relate` | `define` propagator + `spawn` + `wire` each var bidirectionally |

### Example Compilation

```typescript
// CSP Input:
csp.receive({
  variable: {
    name: 'color',
    domain: () => withTaps(quick(intersectionProto, new Set(['R', 'G', 'B'])))
  }
})

// Compiles to Network:
network.receive({
  define: {
    name: 'color',
    factory: () => withTaps(quick(intersectionProto, new Set(['R', 'G', 'B'])))
  }
})
```

```typescript
// CSP Input:
csp.receive({ create: { id: 'v1', type: 'color' }})

// Compiles to Network:
network.receive({ spawn: { id: 'v1', type: 'color' }})
```

```typescript
// CSP Input:
csp.receive({
  relate: {
    vars: ['v1', 'v2'],
    constraint: (d1, d2) => [
      new Set([...d1].filter(x => !d2.has(x))),  // v1 ≠ v2
      new Set([...d2].filter(x => !d1.has(x)))   // v2 ≠ v1
    ]
  }
})

// Compiles to Network:
// 1. Define propagator factory
network.receive({
  define: {
    name: 'propagator_123',
    factory: () => createPropagator(['v1', 'v2'], constraint)
  }
})

// 2. Spawn propagator instance
network.receive({ spawn: { id: 'prop_123', type: 'propagator_123' }})

// 3. Wire bidirectionally
network.receive({ wire: { from: 'v1', to: 'prop_123', via: 'changed' }})
network.receive({ wire: { from: 'v2', to: 'prop_123', via: 'changed' }})
network.receive({ wire: { from: 'prop_123', to: 'v1', via: 'v1_refined' }})
network.receive({ wire: { from: 'prop_123', to: 'v2', via: 'v2_refined' }})
```

## State Structure

```typescript
type CSPState = {
  network: NetworkGadget;  // Underlying network DSL
}
```

## Protocol

```typescript
type CSPProtocol = ProtocolShape<
  CSPInput,
  CSPEffects
>;
```

## Examples

### Map Coloring Problem

```typescript
const csp = createCSPGadget();

// 1. Define variable type (color domain)
csp.receive({
  variable: {
    name: 'color',
    domain: () => withTaps(quick(intersectionProto, new Set(['R', 'G', 'B'])))
  }
});

// 2. Create variables for regions
['wa', 'nt', 'sa', 'q', 'nsw', 'v', 't'].forEach(id => {
  csp.receive({ create: { id, type: 'color' }});
});

// 3. Define "not equal" constraint
const notEqual = (d1: Set<string>, d2: Set<string>) => [
  new Set([...d1].filter(x => !d2.has(x))),
  new Set([...d2].filter(x => !d1.has(x)))
];

// 4. Declare adjacency constraints
csp.receive({ relate: { vars: ['wa', 'nt'], constraint: notEqual }});
csp.receive({ relate: { vars: ['wa', 'sa'], constraint: notEqual }});
csp.receive({ relate: { vars: ['nt', 'sa'], constraint: notEqual }});
csp.receive({ relate: { vars: ['nt', 'q'], constraint: notEqual }});
csp.receive({ relate: { vars: ['sa', 'q'], constraint: notEqual }});
csp.receive({ relate: { vars: ['sa', 'nsw'], constraint: notEqual }});
csp.receive({ relate: { vars: ['sa', 'v'], constraint: notEqual }});
csp.receive({ relate: { vars: ['q', 'nsw'], constraint: notEqual }});
csp.receive({ relate: { vars: ['nsw', 'v'], constraint: notEqual }});

// Constraint propagation happens automatically through taps!
// Each variable's domain shrinks as contradictions are discovered
```

## Design Principles

1. **Domain vocabulary** - Speak in terms of variables and constraints, not gadgets and taps
2. **Automatic propagation** - Relationships propagate changes automatically
3. **Compile to Network** - CSP is sugar over Network DSL
4. **Declarative** - Describe the problem, not the solution process
5. **Composable** - Constraints are just gadgets

## Notes

- Constraint functions must be pure
- Variables are typically intersection cells (monotonically shrinking domains)
- Propagators are gadgets that implement constraint logic
- All propagation happens through taps (fire-and-forget)
- CSP gadget state only contains the Network DSL gadget
