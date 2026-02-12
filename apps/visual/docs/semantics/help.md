---
id: help
name: Help
summary: View and edit documentation stored on any entity
---

# Description

The Help semantic displays and allows editing of documentation stored as attributes on entities. Bind any entity to the Help semantic to see its documentation.

Documentation is stored using `help.*` attributes on entities themselves, making the documentation portable and queryable like any other data.

This creates a self-documenting system: semantics ship with their own documentation, entities can have usage notes, and everything is editable inline.

# Usage

## Mode Selection

- `help.mode` = `direct` (default) | `output`
  - **Direct**: Shows bound entities themselves (use for viewing semantic docs)
  - **Output**: Shows output entities from bound semantics (for composition)

Use Direct mode when you want to see a semantic's own documentation. Use Output mode when you want to see help for entities produced by a semantic pipeline.

## Viewing Documentation

1. Create a Help semantic
2. Bind any entity or semantic to it
3. The Help semantic displays all `help.*` attributes from that entity

## Editing Documentation

1. Click the "Edit" button
2. Modify any help section
3. Changes save automatically on blur
4. Click "Done" when finished

## Adding Custom Sections

In edit mode, use the "Add custom section" input to create new help attributes beyond the standard ones.

## Standard Help Attributes

- `help.summary` = Brief one-line description
- `help.description` = Detailed explanation (multi-line)
- `help.usage` = How to use/configure
- `help.examples` = Example configurations or use cases

Any `help.*` attribute will be displayed, so you can add custom sections like `help.warnings`, `help.related`, `help.changelog`, etc.

# Examples

## Document a custom entity

Add these attributes to any entity:

```
help.summary = User profile component
help.description = Displays user avatar, name, and status. Supports online/offline indicators.
help.usage = Bind to a user entity. Set display.compact = true for smaller variant.
help.examples = <UserProfile user={currentUser} />
```

## View semantic documentation

1. Create a Help semantic
2. Bind a Filter, Map, or other semantic to it
3. See that semantic's built-in documentation

## Create a knowledge base

1. Create entities for each topic
2. Add help.* attributes with content
3. Use Help semantic to browse and edit
4. Use Filter to search topics by content
