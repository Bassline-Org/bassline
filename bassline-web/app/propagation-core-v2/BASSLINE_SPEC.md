# Bassline Specification

## Overview

Basslines are manifests that describe propagation networks. They serve as the universal format for defining, sharing, and composing networks of constraints. In the Bassline system, everything is fundamentally the same thing - a network that can be viewed and used at different levels of abstraction.

## Core Philosophy

1. **Everything is a Bassline**: Whether it's a simple gadget, a complex application, or a distributed system, they're all described by bassline manifests.

2. **Groups are Basslines**: Every group in the system is essentially a bassline - it has topology, can have dependencies, and can be instantiated in various ways.

3. **Open Specification**: Like HTTP headers, basslines support well-known attributes that tools understand, while allowing custom extensions for innovation.

## Unified Model

There are no fundamental distinctions between:
- Gadgets
- Primitives  
- Networks
- Applications

They are all basslines with different attributes:
- **Mutability**: Can the topology change?
- **Purity**: Does it have side effects?
- **Distribution**: Where does it run?
- **Permissions**: Who can modify it?

## Bassline Structure

```typescript
interface Bassline {
  // Identity
  name: string
  version?: string
  hash?: string  // Content-addressed identity
  
  // What to build
  build: {
    topology?: Topology      // Network structure
    gadget?: GadgetDef       // Single gadget
    gadgets?: GadgetDef[]    // Multiple gadgets
  }
  
  // Dependencies on other basslines
  dependencies?: {
    [name: string]: string | BasslineDependency
  }
  
  // Attributes (open-spec)
  attributes?: BasslineAttributes
  
  // Interface when used as gadget
  interface?: {
    inputs: string[]
    outputs: string[]
    bidirectional?: string[]
  }
  
  // Connection information
  connections?: {
    endpoints?: string[]     // Where to find running instances
    signaling?: string[]     // WebRTC signaling servers
    mode?: 'local' | 'remote' | 'distributed'
  }
  
  // Optional seed data
  seeds?: {
    [contactId: string]: any
  }
}
```

## Attribute System

### Well-Known Attributes

Attributes use a namespaced approach to avoid conflicts while remaining extensible:

```typescript
interface BasslineAttributes {
  // Core attributes (bassline.*)
  'bassline.pure'?: boolean              // No side effects
  'bassline.mutable'?: boolean           // Can topology change
  'bassline.singleton'?: boolean         // One global instance
  'bassline.distributed'?: boolean       // Can run across nodes
  'bassline.version'?: string            // Semantic version
  'bassline.hash'?: string              // Content hash for verification
  
  // Dynamic behavior (bassline.dynamic.*)
  'bassline.dynamic-attributes'?: {
    enabled: boolean
    contact?: string                    // Boundary contact for attributes
    mode?: 'replace' | 'merge'
  }
  
  'bassline.dynamic-topology'?: {
    enabled: boolean
    schemaContact: string              // Contact providing topology
    rebuildOn?: 'change' | 'explicit'
  }
  
  // Permissions (permissions.*)
  'permissions.modify'?: string         // Who can edit
  'permissions.instantiate'?: string    // Who can create instances
  'permissions.inspect'?: string        // Who can see internals
  'permissions.execute'?: string        // Who can run it
  
  // Runtime hints (runtime.*)
  'runtime.lazy'?: boolean             // Lazy evaluation
  'runtime.cache'?: boolean            // Can cache results
  'runtime.timeout'?: number           // Max execution time (ms)
  'runtime.priority'?: 'high' | 'normal' | 'low'
  
  // Validation (validation.*)
  'validation.schema'?: string         // Contact providing schema validator
  'validation.upgrade'?: string        // Contact for upgrade validation
  
  // Custom attributes (x-*)
  [key: string]: any                   // Open to extension
}
```

### Custom Extensions

Custom attributes should be prefixed with `x-` to avoid conflicts:

```json
{
  "attributes": {
    "x-ml.model": "gpt-2",
    "x-ml.gpu-required": true,
    "x-audio.sample-rate": 44100,
    "x-auth.provider": "oauth2"
  }
}
```

## Progressive Refinement Lifecycle

Basslines support a natural progression from exploration to production:

### 1. Exploration Phase
```json
{
  "name": "my-experiment",
  "attributes": {
    "bassline.mutable": true,
    "permissions.modify": "anyone"
  }
}
```

### 2. Testing Phase
```json
{
  "name": "my-experiment-beta",
  "attributes": {
    "bassline.mutable": true,
    "permissions.modify": "team",
    "validation.schema": "@schema-check"
  }
}
```

### 3. Production Phase
```json
{
  "name": "my-gadget-v1.0.0",
  "attributes": {
    "bassline.pure": true,
    "bassline.mutable": false,
    "permissions.modify": "none",
    "validation.upgrade": "@upgrade-validator"
  }
}
```

## Dynamic Gadgets

Basslines can have dynamic behavior through special boundary contacts:

### Dynamic Attributes
Attributes can be provided via a boundary contact:

```json
{
  "attributes": {
    "bassline.dynamic-attributes": {
      "enabled": true,
      "contact": "@config"
    }
  },
  "interface": {
    "inputs": ["@config", "data"],
    "outputs": ["result"]
  }
}
```

### Dynamic Topology
The network structure itself can be provided as input:

```json
{
  "attributes": {
    "bassline.dynamic-topology": {
      "enabled": true,
      "schemaContact": "@network-definition",
      "rebuildOn": "change"
    }
  },
  "interface": {
    "inputs": ["@network-definition", "data"],
    "outputs": ["result"]
  }
}
```

## Composition Patterns

### Using Dependencies
```json
{
  "name": "my-app",
  "dependencies": {
    "math": "math-toolkit@1.0.0",
    "ui": "https://example.com/ui-kit.bassline"
  },
  "build": {
    "gadgets": [
      { "from": "math.adder", "as": "add1" },
      { "from": "ui.display", "as": "output" }
    ]
  }
}
```

### Nesting Basslines
```json
{
  "name": "composite-system",
  "build": {
    "gadgets": [{
      "id": "subsystem",
      "bassline": {
        "name": "inline-network",
        "build": { /* ... */ }
      }
    }]
  }
}
```

## Validation and Upgrades

Upgrades can be validated through the propagation network itself:

```json
{
  "name": "validated-upgrade",
  "attributes": {
    "validation.upgrade": "@upgrade-check"
  },
  "build": {
    "gadgets": [
      {
        "id": "upgrade-validator",
        "interface": {
          "inputs": ["@old-version", "@new-version"],
          "outputs": ["@can-upgrade", "@migration-plan"]
        }
      }
    ]
  }
}
```

## Examples

### Simple Primitive Gadget
```json
{
  "name": "temperature-converter",
  "version": "1.0.0",
  "attributes": {
    "bassline.pure": true,
    "bassline.mutable": false
  },
  "build": {
    "topology": {
      "contacts": [
        { "id": "celsius", "blendMode": "accept-last" },
        { "id": "fahrenheit", "blendMode": "accept-last" }
      ],
      "wires": [
        { "from": "celsius", "to": "fahrenheit", "type": "bidirectional" }
      ]
    }
  },
  "interface": {
    "inputs": ["celsius"],
    "outputs": ["fahrenheit"],
    "bidirectional": ["celsius", "fahrenheit"]
  }
}
```

### Distributed Collaborative Application
```json
{
  "name": "team-dashboard",
  "version": "2.1.0",
  "attributes": {
    "bassline.distributed": true,
    "bassline.mutable": true,
    "permissions.modify": "team-members"
  },
  "dependencies": {
    "charts": "chart-gadgets@3.0.0",
    "auth": "auth-system@1.5.0"
  },
  "connections": {
    "mode": "distributed",
    "signaling": ["wss://signal.team.io"],
    "endpoints": ["wss://dashboard.team.io"]
  }
}
```

### Meta-Gadget with Dynamic Topology
```json
{
  "name": "formula-evaluator",
  "attributes": {
    "bassline.dynamic-topology": {
      "enabled": true,
      "schemaContact": "@formula",
      "rebuildOn": "change"
    }
  },
  "interface": {
    "inputs": ["@formula", "A1", "A2", "A3"],
    "outputs": ["result"]
  }
}
```

## Future Directions

### Search and Discovery
- Hoogle-like search by interface signature
- Semantic search by capability
- Runtime discovery of compatible gadgets

### Advanced Patterns
- Meta-propagation networks
- Self-modifying systems
- Distributed consensus gadgets
- Blockchain integration

### Tooling
- Bassline package manager
- Visual bassline editor
- Bassline compiler/optimizer
- Formal verification tools

## Implementation Notes

1. **Backwards Compatibility**: The system should gracefully handle basslines without attributes by providing sensible defaults.

2. **Attribute Propagation**: When attributes are provided via contacts, they should propagate through the network following normal propagation rules, with potential for cycles.

3. **Security**: Certain attributes (especially permissions) should be validated and potentially restricted based on the execution context.

4. **Performance**: Static attributes should be preferred over dynamic ones for performance-critical applications.

5. **Versioning**: Basslines should follow semantic versioning for dependencies and upgrades.