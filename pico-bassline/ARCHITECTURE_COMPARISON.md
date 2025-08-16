# Architecture Comparison: Current vs Proposed

## Executive Summary

This document compares the current pico-bassline implementation with a proposed new architecture based on polarized contacts, shape-based templates, and semantic bindings.

## Current Architecture

### Core Concepts
- **Bidirectional Contacts**: Single entity for both reading and writing
- **Fixed Primitives**: Hard-coded primitive operations
- **Access Control**: Complex rules for boundary contacts
- **Merge Modes**: Built-in merge strategies on contacts

### Implementation
```typescript
// Current Contact
class Contact {
  value: Value
  sources: Set<WeakRef<Contact>>
  targets: Set<WeakRef<Contact>>
  
  wireTo(target: Contact, mode: WireMode) {
    // Complex bidirectional wiring logic
    // Access control checks
  }
  
  setValue(value: Value) {
    this.value = value
    this.propagate()
  }
}

// Current Group
class Group {
  contacts: Map<string, Contact>
  groups: Map<string, Group>
  compute?: ComputeFunction  // For primitives
  
  properties?: Contact  // Meta-contacts
  structure?: Contact
  dynamics?: Contact
  actions?: Contact
}
```

### Benefits
1. **Simplicity**: Single Contact class
2. **Proven**: Working implementation
3. **Flexible**: Bidirectional by default

### Drawbacks
1. **Ambiguous Direction**: Not clear which way data flows
2. **Complex Access Control**: Boundary rules are confusing
3. **Fixed Primitives**: Can't redefine basic operations
4. **Type Unsafe**: No shape validation

## Proposed Architecture

### Core Concepts
- **Polarized Contacts**: Separate input/output contacts with explicit direction
- **Shape-Based Templates**: Structure defined by shape, not types
- **Semantic Bindings**: All behavior (including "primitives") can be redefined
- **Contact Circuits**: Merge/validation logic as composable circuits

### Implementation
```typescript
// Proposed Contact
class Contact {
  polarity: 'input' | 'output'
  value: any  // No type constraints
  connections: Set<Contact>
  
  wireTo(other: Contact) {
    // Only output → input allowed
    if (this.polarity !== 'output' || other.polarity !== 'input') {
      throw new Error('Invalid connection')
    }
    this.connections.add(other)
  }
}

// Proposed Group  
class Group {
  // Explicit input/output shapes
  inputs: Bundle<Contact>   // All input contacts
  outputs: Bundle<Contact>  // All output contacts
  
  // Meta-interface (uniform for all groups)
  meta: {
    properties: { read: Contact, write: Contact },
    structure: { read: Contact },
    dynamics: { read: Contact },
    actions: { write: Contact }
  }
  
  // Semantic binding from parent
  semantics?: Record<string, Template>
  
  // Late binding
  descriptor?: Contact  // Receives template
  materialize() {
    // Build structure from descriptor
  }
}

// Bundles for structured data
type Bundle<T> = Record<string, T>

// Dynamic data as pairs
type Dynamic<T> = {
  data: Contact<'output'>,
  descriptor: Contact<'output'>
}
```

### Benefits
1. **Clear Direction**: Explicit input/output polarity
2. **Shape-Based**: Compatible if shapes match
3. **Fully Customizable**: Everything via semantic bindings
4. **Composable**: Build complex from simple
5. **Visual Clarity**: Different representations for different structures

### Drawbacks
1. **More Complex**: Two contacts for bidirectional
2. **Migration Cost**: Significant refactor needed
3. **Learning Curve**: New concepts to understand

## Side-by-Side Comparison

### Creating a Value Holder

**Current:**
```typescript
const value = group.createContact('value', 42)
// Single contact, bidirectional
```

**Proposed:**
```typescript
const value = group.create('value-holder', {
  write: Contact('input'),
  read: Contact('output')
})
// Explicit input/output
```

### Wiring

**Current:**
```typescript
source.wireTo(target, WireMode.BIDIRECTIONAL)
// Mode determines direction
```

**Proposed:**
```typescript
source.outputs.value.wireTo(target.inputs.value)
target.outputs.feedback.wireTo(source.inputs.feedback)
// Explicit directed connections
```

### Merge Behavior

**Current:**
```typescript
contact.mergeMode = 'max'  // Built-in mode
```

**Proposed:**
```typescript
// Merge as a circuit
const merger = {
  inputs: { current, incoming },
  outputs: { merged },
  compute: () => Math.max(current, incoming)
}
// Fully customizable
```

### Access Control

**Current:**
```typescript
contact.access = {
  boundary: true,
  internal: 'read',
  external: 'write'
}
// Complex rules
```

**Proposed:**
```typescript
// Just expose what should be accessible
group.outputs = { value }  // Read-only
group.inputs = { control }  // Write-only
// Simple exposure
```

### Meta-Propagation

**Current:**
```typescript
group.properties?.setValue(newProps)
// Optional, loosely typed
```

**Proposed:**
```typescript
group.meta.properties.write.setValue(newProps)
// Always present, structured
```

## Migration Analysis

### What Changes

1. **Contact → Input/Output Contacts**
   - Split bidirectional into two directed
   - Update all wiring code

2. **Primitives → Templates**
   - Convert fixed primitives to templates
   - Add semantic binding system

3. **Access Control → Shape Exposure**
   - Remove access control logic
   - Use shape-based compatibility

### What Stays Same

1. **Groups** - Still containers
2. **Propagation** - Still automatic
3. **Meta-contacts** - Still present (better structured)

### Migration Strategy

```typescript
// Compatibility layer
class LegacyContact {
  // Old API
  input: Contact<'input'>
  output: Contact<'output'>
  
  wireTo(other: LegacyContact) {
    this.output.wireTo(other.input)
  }
  
  setValue(value) {
    this.input.receive(value)
  }
  
  getValue() {
    return this.output.value
  }
}
```

## Decision Matrix

| Aspect | Current | Proposed | Winner |
|--------|---------|----------|--------|
| **Simplicity** | Single Contact class | Separate input/output | Current |
| **Clarity** | Ambiguous direction | Explicit polarity | Proposed |
| **Flexibility** | Fixed primitives | Semantic bindings | Proposed |
| **Type Safety** | None | Shape-based | Proposed |
| **Access Control** | Complex rules | Simple exposure | Proposed |
| **Visual Design** | Hard to show direction | Clear flow | Proposed |
| **Learning Curve** | Familiar | New concepts | Current |
| **Extensibility** | Limited | Fully customizable | Proposed |

## Recommendation

### Short Term (Easier)
Keep current architecture but add:
- Visual hints for direction
- Better merge strategy API
- Template system on top

### Long Term (Better)
Migrate to proposed architecture because:
1. **Clearer mental model** - Explicit direction and shapes
2. **More flexible** - Everything customizable via semantics
3. **Better GUI** - Visual representation matches model
4. **Future-proof** - Can evolve without breaking changes

### Hybrid Approach
Start with current, gradually introduce new concepts:
1. Add polarity hints to current contacts
2. Introduce templates alongside primitives
3. Experiment with contact circuits
4. Full migration when proven

## Code Size Comparison

### Current Implementation
- `types.ts`: 83 lines
- `core.ts`: 410 lines
- `primitives.ts`: 179 lines
- **Total**: ~672 lines

### Proposed Implementation (Estimated)
- `types.ts`: ~100 lines (shapes, templates)
- `core.ts`: ~300 lines (simpler Contact)
- `circuits.ts`: ~200 lines (contact circuits)
- `templates.ts`: ~150 lines (semantic bindings)
- **Total**: ~750 lines

## Conclusion

The proposed architecture is more complex initially but provides:
- Clearer conceptual model
- Greater flexibility
- Better visual representation
- Stronger foundation for future features

The current architecture works but has fundamental limitations that will become more problematic as the system grows.

**Recommendation**: Prototype the new architecture in a separate branch to validate the concepts before committing to a full migration.