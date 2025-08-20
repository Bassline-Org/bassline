# Dynamic Gadgets & Spawners

## Overview

Atto-Bassline supports **runtime structure modification** through dynamic gadgets - a universal gadget type that interprets behavior specifications as data. This enables networks that can spawn new structures, evolve their own topology, and hot-swap behaviors while running.

The key insight: **structure modification IS computation** when templates flow as signals through the network.

## Core Concepts

### Dynamic Gadgets

A dynamic gadget is a universal template interpreter with two phases:

1. **Eager Structure** - Contacts and wires built immediately
2. **Late Behavior** - Computation bound when template arrives

```typescript
// All gadgets are instances of one universal type
const gadget = createDynamicGadget(id, spec)

// Behavior flows in as data
propagate(gadget.contacts.get('__behavior'), behaviorSignal)
```

### Templates as Signals

Templates are tagged values that describe gadget structure and behavior:

```typescript
const template = {
  tag: 'template',
  value: {
    gadgetType: 'transistor',
    params: { defaultControl: -5000 },
    contacts: ['input', 'control', 'output'],
    gainPool: 1000
  }
}

// Templates flow through contacts like any signal
propagate(spawner.contacts.get('template'), signal(template, 0.5))
```

### Strength-Based Safety

New structures start with minimal strength and must earn trust:

- Newly spawned gadgets begin with `gainPool = 100`
- Output signals start weak (100-1000 units)
- Strength increases gradually through validation
- Network naturally rejects untrusted structures

## Architecture

### Dynamic Gadget Specification

```typescript
interface DynamicGadgetSpec {
  // Built immediately (eager)
  structure: {
    contacts: {
      [name: string]: {
        direction: 'input' | 'output'
        boundary?: boolean
        validator?: string  // Reference to validator contact
      }
    }
    
    wires: Array<{
      from: string  // Path to source contact
      to: string    // Path to target contact
    }>
    
    children?: {
      [id: string]: DynamicGadgetSpec | { ref: string }
    }
  }
  
  // Bound at runtime (late)
  behavior?: {
    compute?: ComputeSpec
    validator?: ValidatorSpec
  }
  
  // Special binding contacts
  bindings: {
    behavior?: string   // Contact for behavior input
    validator?: string  // Contact for validator input
    library?: string    // Contact for library input
  }
}
```

### Behavior Specification

Behaviors are data structures that describe computation:

```typescript
type BehaviorSpec = {
  // Required external templates/libraries
  requires?: {
    [name: string]: {
      type: 'template' | 'library' | 'value'
      description?: string
    }
  }
  
  // Computation description
  compute?: 
    | { type: 'primitive', name: string }
    | { type: 'expression', expr: any }
    | { type: 'conditional', if: any, then: ComputeSpec, else: ComputeSpec }
    | { type: 'sequence', steps: ComputeSpec[] }
    | { type: 'propagate', from: string, to: string }
}
```

## Key Patterns

### Spawner Pattern

A spawner creates new gadgets from templates:

```typescript
const spawner = createSpawner('spawner1')

// Input: template and trigger
propagate(spawner.contacts.get('template'), templateSignal)
propagate(spawner.contacts.get('trigger'), signal(true, 1.0))

// Output: reference to spawned gadget
const instance = spawner.contacts.get('instance').signal.value
```

### Evolution Pattern

Networks can evolve by spawning improved versions:

```typescript
const evolver = createEvolver('evolver1')

// Gradually transfer strength from old to new
propagate(evolver.contacts.get('old'), oldInstance)
propagate(evolver.contacts.get('new'), newInstance)
propagate(evolver.contacts.get('rate'), signal(100, 1.0))  // 100 units/cycle
```

### Hot-Swapping Pattern

Behaviors can be replaced without rewiring:

```typescript
const processor = createDynamicGadget('proc1', {
  structure: {
    contacts: {
      'input': { direction: 'input' },
      'output': { direction: 'output' },
      '__behavior': { direction: 'input' }
    }
  },
  bindings: { behavior: '__behavior' }
})

// Swap behaviors at runtime
propagate(processor.contacts.get('__behavior'), behavior1)
// Later...
propagate(processor.contacts.get('__behavior'), behavior2)  // Hot-swap!
```

### Validation Pattern

Validators ensure behavior safety:

```typescript
const validated = createDynamicGadget('safe1', {
  structure: {
    contacts: {
      '__behavior': { direction: 'input' },
      '__validator': { direction: 'input' }
    }
  },
  bindings: {
    behavior: '__behavior',
    validator: '__validator'
  }
})

// Attach validator
propagate(validated.contacts.get('__validator'), sandboxValidator)

// Only safe behaviors will execute
propagate(validated.contacts.get('__behavior'), untrustedBehavior)
```

## Example: Self-Building Pipeline

```typescript
// A pipeline that builds its own stages
const pipelineSpec: DynamicGadgetSpec = {
  structure: {
    contacts: {
      'input': { direction: 'input' },
      'output': { direction: 'output' },
      'stageTemplate': { direction: 'input' }  // Template for stages
    },
    
    children: {
      'spawner': {
        // Spawns pipeline stages
        structure: {
          contacts: {
            'template': { direction: 'input' },
            'trigger': { direction: 'input' },
            'instance': { direction: 'output' }
          }
        }
      }
    },
    
    // Core pipeline structure exists immediately
    wires: [
      ['stageTemplate', 'spawner.template'],
      ['input', 'stage1.input'],  // Stages will be spawned
      ['stage3.output', 'output']
    ]
  }
}
```

## Validators

### Type Validator

Ensures behaviors match expected interface:

```typescript
const typeValidator = {
  expectedContacts: ['input', 'output'],
  expectedCompute: 'expression',
  allowedTags: ['add', 'multiply', 'filter']
}
```

### Resource Validator

Prevents resource exhaustion:

```typescript
const resourceValidator = {
  maxGainRequest: 1000,
  maxChildren: 10,
  maxRecursionDepth: 5,
  timeout: 1000
}
```

### Sandbox Validator

Restricts capabilities for untrusted code:

```typescript
const sandboxValidator = {
  deny: ['spawn', 'wire', 'delete'],  // No structural changes
  maxStrength: 5000,  // Cap output strength
  isolate: true  // No access to parent
}
```

## Benefits

1. **Runtime Flexibility** - Modify network topology while running
2. **Safe Evolution** - Gradual strength transfer between versions
3. **No Special Kernel** - Spawners are just gadgets
4. **Compositional** - Templates compose like functions
5. **Debuggable** - Structure visible even without behavior
6. **Fail-Safe** - Invalid behaviors rejected by validators

## Mental Models

### Biological Evolution
- **Templates** = DNA/genes
- **Spawning** = reproduction
- **Strength** = fitness
- **Gain** = resources
- **Evolution** = natural selection

### Software Deployment
- **Templates** = container images
- **Spawning** = deployment
- **Strength** = traffic weight
- **Gain** = resource allocation
- **Hot-swap** = blue-green deployment

### Programming Languages
- **Templates** = code/AST
- **Spawning** = evaluation
- **Validators** = type checkers
- **Libraries** = modules
- **Behavior** = semantics

## Implementation Status

This is a proposed extension to Atto-Bassline that would enable:

- Self-modifying networks
- Runtime structure evolution
- Hot-swappable computation
- Domain-specific spawning languages
- Meta-circular evaluation

The design maintains Atto-Bassline's core principles:
- Everything is a signal with strength
- Gadgets wait for complete inputs
- Types are values (templates are data)
- Contradictions flow as first-class values
- Strength decides conflicts

## Future Directions

- **Distributed Spawning** - Spawn gadgets across network boundaries
- **Persistent Templates** - Save/load template libraries
- **Visual Template Editor** - Design templates graphically
- **Template Optimization** - Compile templates for performance
- **Formal Verification** - Prove template properties

The spawner system transforms Atto-Bassline from a static network into a **living, evolving computational organism**.