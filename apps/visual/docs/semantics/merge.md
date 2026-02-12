---
id: merge
name: Merge
summary: Combine entities from multiple bound sources into one stream
---

# Description

The Merge semantic combines entities from multiple bound sources into a single output stream. This is essential for building complex pipelines where you need to unite results from parallel processing branches.

Key features:
- **Deduplication**: Entities with the same ID are deduplicated (last one wins)
- **Relationship preservation**: Relationships between entities are also merged and deduplicated
- **Zero configuration**: Just bind multiple sources - no configuration needed

Use Merge when you have multiple Filter, Map, or other semantics producing entities that you want to process together downstream.

# Usage

## Basic Usage

1. Create a Merge semantic
2. Bind multiple sources (entities, Filters, Maps, etc.)
3. Bind downstream semantics to the Merge to receive combined output

No configuration attributes are needed - Merge automatically combines all inputs.

## How Deduplication Works

When the same entity ID appears from multiple sources:
- The last occurrence wins
- This means if the same entity is transformed differently by parallel pipelines, you get the most recent version

## Output

Merge outputs:
- All unique entities from all sources
- All unique relationships between those entities

# Examples

## Combine two filter results

```
[Filter A: role=component] ─┐
                            ├─> [Merge] -> [Display]
[Filter B: role=service]  ──┘
```

## Unite parallel transformations

```
[Entities] -> [Filter: type=user] -> [Map: add role=verified] ──┐
                                                                 ├─> [Merge] -> [Template]
[Entities] -> [Filter: type=admin] -> [Map: add role=admin] ────┘
```

## Collect from multiple queries

```
[Filter: layer=ui] ────────┐
[Filter: layer=data] ──────┼─> [Merge] -> [Reflect]
[Filter: layer=service] ───┘
```

## Merge before display

```
[Query A] ─┐
[Query B] ─┼─> [Merge] -> [Display: table]
[Query C] ─┘
```
