---
id: reflect
name: Reflect
summary: Materialize input entities into the project graph
---

# Description

The Reflect semantic is the "write" operation that completes the graph transformation pattern. While Filter reads from the graph and Map/Template transform, Reflect writes transformed entities back as real entities in your project.

This enables powerful automation:
- Query entities, transform them, and create new derived entities
- Sync external data into your graph
- Generate entity structures from templates

Reflect supports three modes for different use cases:

- **Create**: Always create new entities (default)
- **Update**: Update existing entities if they match, create if not found
- **Sync**: Full sync - create, update, AND delete entities not in inputs

# Usage

## Configuration

- `reflect.mode` = `create` (default) | `update` | `sync`
- `reflect.target` = Parent entity ID for new entities (empty = root level)
- `reflect.matchAttr` = Attribute to match on in update/sync modes (default: `name`)

## Modes

### Create Mode

Every input entity creates a new entity in the graph. Simple and safe - never modifies existing entities.

### Update Mode

For each input, look for an existing entity with matching `matchAttr` value:
- If found: Update that entity's attributes
- If not found: Create new entity

### Sync Mode

Like update mode, but also deletes entities that exist in the graph but aren't in the inputs. Use with caution - this can remove entities.

## What Gets Copied

All attributes from input entities are copied except position-related ones (`x`, `y`, `ui.width`, `ui.height`).

# Examples

## Create entities from a query pipeline

```
[Filter: role=component] -> [Map: add processed=true] -> [Reflect: create]
```

## Update entities based on external data

```
reflect.mode = update
reflect.matchAttr = externalId
```

## Sync a folder structure

```
reflect.mode = sync
reflect.target = <folder-entity-id>
reflect.matchAttr = filepath
```

## Create child entities under a parent

```
reflect.mode = create
reflect.target = <parent-entity-id>
```

## Match by custom attribute

```
reflect.mode = update
reflect.matchAttr = slug
```
