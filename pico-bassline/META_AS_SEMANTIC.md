# Meta-Contacts as Semantic Bindings

## The Insight

Meta-contacts don't need to be special-cased in the core runtime. They're just semantically-bound gadgets that expose internal properties of their parent group. This makes the system more uniform and flexible.

## Current Implementation (Special-Cased)

```typescript
class Group {
  // Hard-coded meta-contacts
  constructor() {
    this.contacts.set('meta-properties', new Contact(...))
    if (!primitive) {
      this.contacts.set('meta-structure', new Contact(...))
      this.contacts.set('meta-dynamics', new Contact(...))
      this.contacts.set('meta-actions', new Contact(...))
    }
  }
  
  // Special access rules
  canWrite(from: Contact): boolean {
    if (this.id.startsWith('meta-')) {
      // Complex special-case logic
    }
  }
}
```

## Proposed: Meta as Semantic Bindings

```typescript
// Core has NO knowledge of meta-contacts
class Group {
  inputs: Bundle<Contact>
  outputs: Bundle<Contact>
  semantics?: Record<string, Template>
  
  // That's it - no meta-specific code!
}

// Runtime provides meta gadgets via semantic bindings
const RUNTIME_SEMANTICS = {
  'meta-properties': {
    type: 'primitive',
    compute: function(this: Group) {
      // Access parent's actual properties
      return this.parent?.internalProperties
    },
    outputs: { value: Contact('output') }
  },
  
  'meta-structure': {
    type: 'primitive', 
    compute: function(this: Group) {
      // Build structure from parent's actual state
      return {
        inputs: Object.keys(this.parent?.inputs || {}),
        outputs: Object.keys(this.parent?.outputs || {}),
        children: [...(this.parent?.children || [])]
      }
    },
    outputs: { value: Contact('output') }
  },
  
  'meta-dynamics': {
    type: 'stream',
    // Special stream gadget that captures propagation events
    capture: 'propagation-events',
    outputs: { stream: Contact('output') }
  },
  
  'meta-actions': {
    type: 'primitive',
    inputs: { action: Contact('input') },
    compute: function(inputs) {
      // Execute action on parent
      this.parent?.executeAction(inputs.action)
    }
  }
}
```

## How It Works

### 1. Groups Request Meta-Gadgets

```typescript
// When a group wants meta-capabilities
const group = new Group('my-group')

// Runtime adds meta-gadgets as children
group.addChild('properties', runtime.instantiate('meta-properties'))
group.addChild('structure', runtime.instantiate('meta-structure'))
group.addChild('dynamics', runtime.instantiate('meta-dynamics'))
group.addChild('actions', runtime.instantiate('meta-actions'))
```

### 2. Parent Controls Meta Availability

```typescript
// Parent can override semantics to disable meta
const restrictedContext = {
  semantics: {
    'meta-properties': null,  // Disabled
    'meta-structure': null,   // Disabled
    'meta-dynamics': customDynamicsImpl,  // Custom implementation
    'meta-actions': null      // Disabled
  }
}

// Children in this context won't have standard meta
const child = restrictedContext.createGroup('child')
// No meta-gadgets added, or custom ones used
```

### 3. Access Control via Standard Mechanisms

```typescript
// No special access rules needed!
// Meta-gadgets use standard input/output contacts

// Properties gadget: output-only (read-only from outside)
metaProperties.outputs.value  // Read properties

// Actions gadget: input-only (write-only from outside)  
metaActions.inputs.action     // Send actions

// Structure: output-only
metaStructure.outputs.value   // Read structure

// Dynamics: output-only, but special "no internal read" rule
// This is enforced by the gadget itself, not core
metaDynamics.outputs.stream   // Read event stream
```

## Benefits

### 1. Simpler Core
- No special-case code for meta-contacts
- No complex access control rules
- Just contacts with polarity

### 2. More Flexible
- Can have custom meta implementations
- Can disable meta entirely
- Can add new meta-gadgets without changing core

### 3. Uniform Model
- Everything is just gadgets and semantic bindings
- No "magic" contacts with special rules
- Access control through standard input/output mechanism

### 4. Composable
- Meta-gadgets can be composed like any other gadget
- Can have meta-meta-gadgets (meta-properties of meta-properties)
- Can wire meta-gadgets to each other

## Implementation Strategy

### Phase 1: Remove Special Cases from Core

```typescript
// Before
class Contact {
  canWrite(from: Contact): boolean {
    // Remove all meta-specific logic
    if (this.id.startsWith('meta-')) { ... }  // DELETE THIS
  }
}

class Group {
  constructor() {
    // Remove automatic meta-contact creation
    this.contacts.set('meta-properties', ...)  // DELETE THIS
  }
}
```

### Phase 2: Define Meta as Templates

```typescript
const META_TEMPLATES = {
  properties: {
    polarity: { outputs: ['value'] },
    primitive: true,
    semantics: 'runtime:properties-reader'
  },
  
  structure: {
    polarity: { outputs: ['value'] },
    primitive: true,
    semantics: 'runtime:structure-reader'
  },
  
  dynamics: {
    polarity: { outputs: ['stream'] },
    primitive: true,
    semantics: 'runtime:event-stream'
  },
  
  actions: {
    polarity: { inputs: ['action'] },
    primitive: true,
    semantics: 'runtime:action-executor'
  }
}
```

### Phase 3: Runtime Instantiation

```typescript
class Runtime {
  createGroup(id: string, options?: GroupOptions) {
    const group = new Group(id)
    
    // Add meta-gadgets if requested (default: true)
    if (options?.meta !== false) {
      this.addMetaGadgets(group, options?.metaOverrides)
    }
    
    return group
  }
  
  addMetaGadgets(group: Group, overrides?: MetaOverrides) {
    // Use semantic bindings to create meta-gadgets
    const semantics = { ...RUNTIME_SEMANTICS, ...overrides }
    
    if (semantics['meta-properties']) {
      group.addChild('$properties', this.instantiate(semantics['meta-properties']))
    }
    // ... etc for other meta-gadgets
  }
}
```

## Special Considerations

### 1. Bootstrap Problem
- How do meta-gadgets access parent state if they're just regular gadgets?
- Solution: Special "privileged" semantic bindings that have parent access

### 2. Dynamics Stream
- Need to prevent reading dynamics from same group (infinite loop)
- Solution: Gadget implementation enforces this, not core

### 3. Properties Modification  
- How to modify properties if it's just an output?
- Solution: Separate setter gadget, or bidirectional properties gadget

### 4. Performance
- Calling gadget compute functions for every property access?
- Solution: Caching, lazy evaluation, or direct property access for hot paths

## Migration Path

1. **Keep current API working**: Provide compatibility shims
2. **Gradually move logic**: Extract meta-logic to semantic gadgets
3. **Update tests**: Ensure behavior unchanged
4. **Remove special cases**: Clean up core once gadgets work
5. **Optimize**: Add caching/fast paths as needed

## Example: Self-Describing Group

With meta as semantic gadgets, groups become truly self-describing:

```typescript
const group = runtime.createGroup('example')

// The group's children include its meta-gadgets
group.children = {
  '$properties': MetaPropertiesGadget,
  '$structure': MetaStructureGadget,
  '$dynamics': MetaDynamicsGadget,
  '$actions': MetaActionsGadget,
  'userGadget1': ...,
  'userGadget2': ...
}

// Reading structure shows the meta-gadgets too!
group.children['$structure'].outputs.value = {
  children: ['$properties', '$structure', '$dynamics', '$actions', 'userGadget1', 'userGadget2']
}

// Completely self-describing and uniform!
```

## Conclusion

Making meta-contacts into semantically-bound gadgets rather than special-cased features:
1. Simplifies the core dramatically
2. Makes the system more flexible and extensible
3. Provides a uniform model where everything is just gadgets
4. Enables custom meta implementations per context
5. Removes complex access control rules in favor of simple polarity

This is the right architectural direction - it makes the system both simpler AND more powerful.