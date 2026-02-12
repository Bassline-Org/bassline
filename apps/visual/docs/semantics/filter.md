---
id: filter
name: Filter
summary: Filter entities from the graph or bound inputs using predicates
---

# Description

The Filter semantic selects entities based on matching criteria. It supports two modes:

**Manual mode** operates on entities explicitly bound to the filter. Use this when you want to filter a specific set of entities that you've connected.

**Query mode** scans all entities in the project graph without needing manual bindings. This is powerful for discovering entities that match certain criteria across your entire project.

The filtered entities are passed downstream to any semantics bound to this Filter, enabling composition patterns like Filter -> Map -> Template.

# Usage

## Mode Selection

Set the filter mode via attribute:
- `filter.mode` = `manual` (default) | `query`

## Manual Mode

Filter bound entities using a predicate string:
- `filter.predicate` = Predicate expression

Predicate formats:
- `attr` - Entity has the attribute (existence check)
- `attr:value` - Exact match
- `attr:prefix*` - Starts with prefix
- `attr:*suffix` - Ends with suffix
- `attr:*contains*` - Contains substring

## Query Mode

Query all project entities using multiple predicates. Each `filter.where.*` attribute adds a predicate condition (all are ANDed together):

- `filter.where.<attr>` = Predicate value

Predicate syntax:
- `value` - Exact match
- `~pattern` - Glob pattern (* and ? wildcards)
- `!value` - Not equal
- `>N` - Greater than (numeric)
- `<N` - Less than (numeric)
- `>=N` - Greater than or equal
- `<=N` - Less than or equal
- (empty) - Attribute exists

# Examples

## Find all components (Query mode)

```
filter.mode = query
filter.where.role = component
```

## Find TypeScript files (Query mode with glob)

```
filter.mode = query
filter.where.filepath = ~*.tsx
```

## Find items with priority > 5 (Query mode with comparison)

```
filter.mode = query
filter.where.priority = >5
```

## Filter bound entities by name prefix (Manual mode)

```
filter.mode = manual
filter.predicate = name:User*
```

## Combine multiple conditions (Query mode)

```
filter.mode = query
filter.where.role = component
filter.where.status = !deprecated
filter.where.layer = ui
```
