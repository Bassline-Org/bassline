---
id: map
name: Map
summary: Transform entity attributes using set, add, and remove operations
---

# Description

The Map semantic applies transformation rules to each input entity, producing modified entities with updated attributes. This is a pure N -> N transformation: one input entity produces one output entity.

Map supports three operations:
- **set** - Always set the attribute to a value (overwrites existing)
- **add** - Only set the attribute if it doesn't already exist
- **remove** - Delete the attribute from the entity

Values support interpolation with `${attr}` syntax to reference the entity's existing attributes.

The transformed entities are passed downstream to bound semantics, enabling pipelines like Filter -> Map -> Template.

# Usage

## Operations

Add transformation rules via attributes:

- `map.set.<attrName>` = Value to set (supports `${attr}` interpolation)
- `map.add.<attrName>` = Value to add if attr doesn't exist
- `map.remove.<attrName>` = `true` to remove the attribute

## Interpolation

Use `${attrName}` in values to reference the entity's current attributes:

```
map.set.fullName = ${firstName} ${lastName}
```

# Examples

## Add a role to all entities

```
map.set.role = component
```

## Construct a derived attribute

```
map.set.displayName = ${name} (${type})
```

## Add default status if missing

```
map.add.status = pending
```

## Remove internal attributes before export

```
map.remove._internal = true
map.remove._debug = true
```

## Build a filepath from parts

```
map.set.filepath = ${basePath}/${name}.${extension}
```

## Multiple transformations

```
map.set.processed = true
map.set.label = [${category}] ${name}
map.add.priority = 5
map.remove.draft = true
```
