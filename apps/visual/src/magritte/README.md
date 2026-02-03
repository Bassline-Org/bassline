# Magritte

A port of the magritte meta description framework for building forms with consequential validation.

![pipe](../../docs/images/pipe.jpg)

## Core Idea

Magritte describes object structure declaratively. Unlike traditional validation that blocks invalid states, magritte use **consequential validation**: invalid states are allowed but have visible effects.

```tsx
const userDescription = describe.container<User>({
  children: [
    describe.string<User>({
      accessor: prop('name'),
      label: 'Name',
      required: true,
      maxLength: 50,
      onTooLong: 'truncate', // Show what happens, don't block
    }),
    describe.number<User>({
      accessor: prop('age'),
      min: 0,
      max: 150,
      onOutOfRange: 'clamp', // Value will be clamped to range
    }),
  ],
})
```

## Architecture

```text
description.ts   - Core types: Accessor, Description variants, factories
conditions.ts    - Composable validation predicates (all, any, not, ...)
hooks.ts         - React hooks with Jotai atoms for fine-grained reactivity
fields.tsx       - Shadcn-based field components
```

## Descriptions

| Kind        | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `string`    | Text with length constraints, patterns             |
| `number`    | Numeric with range, step, integer flag             |
| `boolean`   | Checkbox, switch, or toggle                        |
| `container` | Groups child descriptions                          |
| `toOne`     | Single related object (dropdown + inline edit)     |
| `toMany`    | Collection of related objects (list + inline edit) |

## Accessors

Accessors decouple descriptions from object shape: Like a lens from the world of fp optics

```tsx
// Simple property
prop('name') // { read: m => m.name, write: (m, v) => ({...m, name: v}) }

// Custom path
path(
  m => m.settings.theme,
  (m, v) => ({ ...m, settings: { ...m.settings, theme: v } })
)
```

## Conditions

Composable predicates for validation:

```tsx
import { all, minLength, maxLength, pattern, isEmail } from './conditions'

// Combine conditions
const validUsername = all(minLength(3), maxLength(20), pattern(/^[a-z0-9_]+$/))

// Convert to validator
const validator = conditionToValidator(validUsername, 'Invalid username')
```

## React Integration

### useDescribedState

Manages draft state with Jotai atoms:

```tsx
const { draft, update, validation, hasErrors, reset } = useDescribedState(userDescription, initialUser)
```

### Fine-Grained Reactivity

ToOne and ToMany fields use per-item Jotai atoms:

- Editing one item doesn't re-render siblings
- Draft edits are local until committed (on editor close)
- Dropdown selection uses label comparison, not reference equality

### DescribedForm

Renders a complete form from a container description:

```tsx
<DescribedForm
  description={userDescription}
  model={draft}
  onChange={update}
  validation={validation}
  hasErrors={hasErrors}
/>
```

## Prior Art

**Glamourous Toolkit** (Pharo Smalltalk / Kinda it's own thing) GT uses magritte descriptions for building out form style interactions with objects.

**Original Magritte** (Seaside/Smalltalk) Meta-description framework for web forms. This implementation adapts the core ideas (descriptions, accessors, validation) for React with modern patterns (Jotai atoms, TypeScript)
