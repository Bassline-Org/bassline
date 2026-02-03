# Magritte

A port of the magritte meta description framework for building forms with consequential validation.

![pipe](../../docs/images/pipe.jpg)

## Core Idea

Magritte describes object structure declaratively. Unlike traditional validation that blocks invalid states, magritte uses **consequential validation**: invalid states are allowed but have visible effects.

```tsx
const userSchema = schema.container({
  children: {
    name: schema.string({
      label: 'Name',
      required: true,
      maxLength: 50,
      onTooLong: 'truncate', // Show what happens, don't block
    }),
    age: schema.number({
      min: 0,
      max: 150,
      onOutOfRange: 'clamp', // Value will be clamped to range
    }),
  },
})
```

## Architecture: Schema + Bound

The framework separates concerns into two layers:

- **Schema**: Pure metadata, no generics, defines structure and constraints
- **Bound**: Runtime binding that connects schemas to model instances

This design eliminates type casts in components by using discriminated union narrowing.

```text
schema.ts       - Schema types (no generics): StringSchema, ContainerSchema, etc.
bound.ts        - Bound types + binding functions: bindContainer, bindField
validation.ts   - Validation for bound descriptions
hooks.ts        - React hooks: useBoundState, useBoundValidation
fields.tsx      - Shadcn-based field components (zero casts!)
conditions.ts   - Composable validation predicates
```

## Schemas

| Kind        | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `string`    | Text with length constraints, patterns             |
| `number`    | Numeric with range, step, integer flag             |
| `boolean`   | Checkbox, switch, or toggle                        |
| `container` | Groups child schemas by property name              |
| `toOne`     | Single related object (dropdown + inline edit)     |
| `toMany`    | Collection of related objects (list + inline edit) |

## Bound Types

When a schema is bound to a model, it becomes a **BoundDescription** with direct read/write access:

```tsx
// Schema has no read/write - just metadata
const nameSchema = schema.string({ label: 'Name', required: true })

// Bound description has read/write closures over the model
const boundName: BoundString = {
  ...nameSchema,
  key: 'name',
  read: () => model.name, // typed as string
  write: v => setModel({ ...model, name: v }), // takes string
}
```

This means:

- `BoundString.read()` returns `string`, not `unknown`
- `BoundString.write(v)` takes `string`, not `unknown`
- TypeScript's discriminated union narrowing works perfectly

## Why This Matters

The old generic-based design had a fundamental problem:

```tsx
// Old: Generic V in contravariant position
type Accessor<T, V> = {
  write: (model: T, value: V) => T // V is contravariant!
}

// When stored in union, V becomes unknown
type AnyDescription<T> = StringDescription<T> | NumberDescription<T>
// StringDescription.accessor.write expects string
// But AnyDescription.accessor.write expects unknown
// Result: casts everywhere!
```

The new bound design solves this:

```tsx
// New: Concrete types, no generic V
type BoundString = { kind: 'string'; read(): string; write(v: string): void }
type BoundNumber = { kind: 'number'; read(): number; write(v: number): void }
type AnyBound = BoundString | BoundNumber | ...

// Discriminated union narrowing works!
function handle(bound: AnyBound) {
  if (bound.kind === 'string') {
    bound.write("hello")  // No cast needed!
  }
}
```

## Conditions

Composable predicates for validation:

```tsx
import { all, minLength, maxLength, pattern, isEmail } from './conditions'

// Combine conditions
const validUsername = all(minLength(3), maxLength(20), pattern(/^[a-z0-9_]+$/))

// Convert to validator for use in schema.validate
const validator = conditionToValidator(validUsername, 'Invalid username')
```

## React Integration

### useBoundState

Manages model state and creates bound descriptions:

```tsx
const { bound, model, validation, hasErrors, reset } = useBoundState(userSchema, initialUser)
```

### BoundForm

Renders a complete form from a bound container:

```tsx
<BoundForm bound={bound} validation={validation} hasErrors={hasErrors} />
```

### Fine-Grained Reactivity

ToOne and ToMany fields use local state for drafts:

- Editing one item doesn't re-render siblings
- Draft edits are local until committed (on editor close)
- Dropdown selection uses label comparison, not reference equality

## Prior Art

**Glamorous Toolkit** (Pharo Smalltalk) - GT uses magritte descriptions for building form-style interactions with objects.

**Original Magritte** (Seaside/Smalltalk) - Meta-description framework for web forms. This implementation adapts the core ideas (descriptions, accessors, validation) for React with modern TypeScript patterns.
