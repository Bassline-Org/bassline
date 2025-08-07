# Mergeable Data Types for Bassline Propagation Networks

This module provides mergeable data types that support constraint propagation with structural equality and wire-safe serialization.

## Core Concepts

### Complete vs Refinable Types

- **Complete Types**: Fully-determined values (primitives, objects). When merged:
  - Same value → Keep the value  
  - Different values → Contradiction

- **Refinable Types**: Partial information/constraints. When merged:
  - Compatible constraints → Refined/narrowed result
  - Incompatible constraints → Contradiction

### Growing vs Shrinking Collections

- **Growing Collections**: Accumulate values via union operations
- **Shrinking Collections**: Narrow down via intersection operations

## Tagged Collection Types

### GrowSet - Accumulating Sets
```typescript
import { grow } from '~/propagation-core-v2/mergeable'

const tags1 = grow.set(['react', 'typescript'])
const tags2 = grow.set(['typescript', 'nodejs'])
const merged = await mergeContent(tags1, tags2)
// Result: GrowSet(['react', 'typescript', 'nodejs'])
```

### ShrinkSet - Constraint Sets
```typescript
import { shrink } from '~/propagation-core-v2/mergeable'

const allowed1 = shrink.set(['read', 'write', 'delete'])
const allowed2 = shrink.set(['read', 'write'])
const merged = await mergeContent(allowed1, allowed2)
// Result: ShrinkSet(['read', 'write'])
```

### GrowArray - Concatenating Arrays
```typescript
const items1 = grow.array([1, 2, 3])
const items2 = grow.array([4, 5])
const merged = await mergeContent(items1, items2)
// Result: GrowArray([1, 2, 3, 4, 5])
```

### ShrinkArray - Intersecting Arrays
```typescript
const options1 = shrink.array(['red', 'blue', 'green'])
const options2 = shrink.array(['blue', 'green', 'yellow'])
const merged = await mergeContent(options1, options2)
// Result: ShrinkArray(['blue', 'green'])
```

### GrowMap - Recursive Map Merging
```typescript
const config1 = grow.map([
  ['server', grow.map([['port', 3000]])],
  ['features', grow.set(['auth', 'logging'])]
])

const config2 = grow.map([
  ['server', grow.map([['host', 'localhost']])],
  ['features', grow.set(['metrics'])]
])

const merged = await mergeContent(config1, config2)
// Result: GrowMap with merged server config and combined features
```

### ShrinkMap - Key Intersection
```typescript
const schema1 = shrink.map([
  ['name', 'string'],
  ['age', 'number'],
  ['email', 'string']
])

const schema2 = shrink.map([
  ['name', 'string'],
  ['age', 'number']
])

const merged = await mergeContent(schema1, schema2)
// Result: ShrinkMap with only common keys
```

## Usage in Propagation Networks

### Creating Mergeable Contacts
```typescript
import { grow, shrink } from '~/propagation-core-v2/mergeable'

// Create a contact with growing set behavior
const contact = {
  id: 'tags',
  content: grow.set(['initial', 'tag']),
  blendMode: 'merge' as const,
  groupId: 'main'
}

// When new values propagate, they accumulate
await propagateContent(network, 'tags', grow.set(['additional', 'tag']))
// Contact now contains: GrowSet(['initial', 'tag', 'additional'])
```

### Constraint Propagation Example
```typescript
// Temperature sensor constraints
const sensor1Reading = shrink.map([
  ['temperature', shrink.array([20, 21, 22, 23, 24, 25])], // Possible values
  ['confidence', 0.8]
])

const sensor2Reading = shrink.map([
  ['temperature', shrink.array([22, 23, 24, 25, 26])], // Overlapping range
  ['confidence', 0.9]  
])

// When merged, temperature narrows to intersection
const merged = await mergeContent(sensor1Reading, sensor2Reading)
// Result: temperature constrained to [22, 23, 24, 25]
```

## Contradictions

When incompatible values are merged, contradictions are thrown:

```typescript
// Shrinking sets with no overlap
const set1 = shrink.set(['red', 'blue'])
const set2 = shrink.set(['green', 'yellow'])

try {
  await mergeContent(set1, set2)
} catch (error) {
  console.log(error.reason) // "Empty set intersection"
}

// Different scalar values
try {
  await mergeContent('hello', 'world')
} catch (error) {
  console.log(error.reason) // "Values cannot be merged"
}
```

## Serialization for Workers

Tagged collections automatically serialize/deserialize across worker boundaries:

```typescript
import { serializeTaggedCollection, deserializeTaggedCollection } from '~/propagation-core-v2/mergeable'

const collection = grow.map([
  ['nested', shrink.set(['a', 'b', 'c'])]
])

// Serialize for worker communication
const serialized = serializeTaggedCollection(collection)
const afterWorker = JSON.parse(JSON.stringify(serialized))
const restored = deserializeTaggedCollection(afterWorker)

// Restored collection maintains all merge behavior
```

## Advanced Patterns

### Typed Wrappers
```typescript
// Create domain-specific types
interface UserPreferences {
  theme: 'light' | 'dark'
  languages: string[]
  notifications: boolean
}

function createUserPrefs(initial: Partial<UserPreferences>) {
  return grow.map([
    ['theme', initial.theme || 'light'],
    ['languages', grow.set(initial.languages || [])],
    ['notifications', initial.notifications ?? true]
  ])
}
```

### Conditional Merging
```typescript
// Use ShrinkSets for option narrowing
const browserSupport = shrink.set(['chrome', 'firefox', 'safari', 'edge'])
const userAgent = shrink.set(['chrome', 'firefox']) // Detected capabilities
const targetBrowsers = shrink.set(['chrome', 'safari']) // Project requirements

// Final supported browsers: intersection of all constraints
const supported = await mergeContent(
  await mergeContent(browserSupport, userAgent),
  targetBrowsers
)
// Result: ShrinkSet(['chrome'])
```

## Performance Considerations

- Structural equality performs deep comparison but is optimized for typical use cases
- Large collections (>1000 items) use efficient Set/Map operations
- Serialization is optimized with recursive handling of nested collections
- Memory usage is minimized through structural sharing where possible

## Integration with Primitive Gadgets

Mergeable data works seamlessly with primitive gadgets:

```javascript
// Example: Set union gadget
const setUnionGadget = {
  id: 'set-union',
  inputs: ['setA', 'setB'], 
  outputs: ['union'],
  activation: (inputs) => inputs.has('setA') && inputs.has('setB'),
  body: async (inputs) => {
    const setA = inputs.get('setA')
    const setB = inputs.get('setB')
    
    if (setA._tag === 'GrowSet' && setB._tag === 'GrowSet') {
      const union = grow.set([...setA.values, ...setB.values])
      return new Map([['union', union]])
    }
    
    throw new Error('Expected GrowSet inputs')
  }
}
```

This system provides a powerful foundation for constraint propagation while maintaining the simplicity and performance characteristics required for real-time collaborative editing.