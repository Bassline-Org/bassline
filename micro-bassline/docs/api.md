# API Reference

## Core Types

### Stream Types

```typescript
interface Stream<T> {
  write(value: T): void
  pipe(target: Stream<T> | ((value: T) => void)): Stream<T>
  filter(predicate: (value: T) => boolean): Stream<T>
  transform<U>(fn: (value: T) => U | Promise<U>): Stream<U>
  subscribe(handler: (value: T) => void): () => void
  tee(): [Stream<T>, Stream<T>]
}
```

### Contact Types

```typescript
interface Contact {
  id: ContactId
  stream: Stream<any>
  getValue(): any
  setValue(value: any): void
  wireTo(target: Contact, bidirectional?: boolean): void
  canWireTo(target: Contact): boolean
  onValueChange(handler: (value: any) => void): () => void
  groupId?: string
  properties: Record<string, any>
}

type BlendMode = 'merge' | 'last'
```

### Group Types

```typescript
interface Group {
  id: string
  parentId?: string
  contacts: Map<ContactId, Contact>
  getBoundaryContacts(): Set<ContactId>
  eventStream: Stream<any>
  properties?: Record<string, any>
  createContact(id: ContactId, blendMode?: BlendMode, isBoundary?: boolean, properties?: Record<string, any>): Contact
  getContact(id: ContactId): Contact | undefined
}
```

### Runtime Types

```typescript
interface Runtime {
  groups: Map<GroupId, Group>
  contacts: Map<ContactId, Contact>
  wires: Map<WireId, { from: ContactId, to: ContactId, bidirectional: boolean }>
  eventStream: Stream<any>
  
  createGroup(groupId?: GroupId, primitiveType?: string, properties?: Properties, parentId?: GroupId): Group
  createContact(contactId: ContactId, groupId: GroupId, blendMode?: BlendMode, properties?: Properties): Contact
  createWire(wireId: WireId, fromId: ContactId, toId: ContactId, bidirectional?: boolean): void
  setValue(groupId: GroupId, contactId: ContactId, value: any): void
  getValue(groupId: GroupId, contactId: ContactId): any
  applyAction(action: any): void
  getBassline(): Bassline
}
```

## Factory Functions

### stream<T>()

Creates a new stream.

```typescript
const s = stream<number>()
s.write(42)
s.subscribe(value => console.log(value))
```

### contact()

Creates a new contact.

```typescript
const c = contact(
  id: ContactId,
  blendMode: BlendMode = 'merge',
  groupId?: string,
  properties: Record<string, any> = {}
)
```

### group()

Creates a new group.

```typescript
const g = group(
  id: string,
  parentId?: string,
  properties?: Record<string, any>
)
```

### runtime()

Creates a new runtime.

```typescript
const rt = runtime(
  bassline?: Bassline,  // Initial state
  primitives?: Record<string, GadgetConfig>  // Available primitives
)
```

## Action Functions

### Structure Actions

```typescript
createGroup(groupId: GroupId, parentId?: GroupId, properties?: Properties): Action
deleteGroup(groupId: GroupId): Action
createContact(contactId: ContactId, groupId?: GroupId, properties?: Properties): Action  
deleteContact(contactId: ContactId): Action
createWire(wireId: WireId, fromId: ContactId, toId: ContactId, properties?: Properties): Action
deleteWire(wireId: WireId): Action
```

### Value Actions

```typescript
setValue(groupId: GroupId, contactId: ContactId, value: any): Action
updateProperties(entityId: string, properties: Properties): Action
```

### Batch Actions

```typescript
applyAll(runtime: Runtime, actions: Action[]): void
fromArray(array: any[]): Action  // Convert legacy array format
```

## Primitive Gadgets

### Math Primitives

```typescript
mathPrimitives = {
  add: { inputs: ['a', 'b'], outputs: ['sum'] },
  subtract: { inputs: ['a', 'b'], outputs: ['difference'] },
  multiply: { inputs: ['a', 'b'], outputs: ['product'] },
  divide: { inputs: ['numerator', 'denominator'], outputs: ['quotient'] }
}
```

### String Primitives

```typescript
stringPrimitives = {
  concat: { inputs: ['a', 'b'], outputs: ['result'] },
  split: { inputs: ['text', 'separator'], outputs: ['parts'] },
  join: { inputs: ['items', 'separator'], outputs: ['result'] }
}
```

### Logic Primitives

```typescript
logicPrimitives = {
  and: { inputs: ['a', 'b'], outputs: ['result'] },
  or: { inputs: ['a', 'b'], outputs: ['result'] },
  not: { inputs: ['value'], outputs: ['result'] },
  equals: { inputs: ['a', 'b'], outputs: ['result'] }
}
```

### Control Primitives

```typescript
controlPrimitives = {
  gate: { inputs: ['value', 'open'], outputs: ['output'] },
  select: { inputs: ['condition', 'ifTrue', 'ifFalse'], outputs: ['result'] }
}
```

### Array Primitives

```typescript
arrayPrimitives = {
  length: { inputs: ['array'], outputs: ['length'] },
  index: { inputs: ['array', 'index'], outputs: ['value'] },
  push: { inputs: ['array', 'item'], outputs: ['result'] },
  pop: { inputs: ['array'], outputs: ['result', 'item'] }
}
```

## Persistence Functions

### exportGroup()

Exports a group with structure/data separation.

```typescript
const exported = exportGroup(
  runtime: Runtime,
  groupId: GroupId,
  includeInternals: boolean = false
): ExportedGroup

// Returns:
interface ExportedGroup {
  structure: Bassline
  data: Array<[ContactId, any]>
}
```

### importGroup()

Imports a group into a runtime.

```typescript
importGroup(
  runtime: Runtime,
  exported: ExportedGroup,
  parentId?: GroupId
): GroupId
```

## Utility Functions

### guards

Helper functions for gadget input validation.

```typescript
guards = {
  hasInputs: (...keys: string[]) => (value: any) => boolean
  hasTypes: (types: Record<string, string>) => (value: any) => boolean
  isFinite: (...keys: string[]) => (value: any) => boolean
  all: <T>(...guards: Array<(value: T) => boolean>) => (value: T) => boolean
  any: <T>(...guards: Array<(value: T) => boolean>) => (value: T) => boolean
}
```

### merge()

Merges multiple streams into one.

```typescript
const merged = merge(stream1, stream2, stream3)
// All values from all streams flow through merged
```

### generateUUID()

Generates a UUID for group identification.

```typescript
const id = generateUUID()
// Returns: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
```

## Mergeable Types

Special types for constraint propagation:

```typescript
// Growing types (union semantics)
Grow.GrowSet<T>    // Set that grows with merge
Grow.GrowArray<T>  // Array that grows with merge
Grow.GrowMap<K,V>  // Map that grows with merge

// Shrinking types (intersection semantics)
Shrink.ShrinkSet<T>   // Set that shrinks with merge
Shrink.ShrinkArray<T> // Array that shrinks with merge
```

Example:

```typescript
const a = new Grow.GrowSet([1, 2])
const b = new Grow.GrowSet([2, 3])
const merged = a.merge(b)  // GrowSet([1, 2, 3])
```