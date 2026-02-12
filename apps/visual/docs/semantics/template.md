---
id: template
name: Template
summary: Generate text and code using Handlebars templates
---

# Description

The Template semantic applies Handlebars templates to entities, generating text or code. It supports two modes for different use cases:

**Map mode** (N -> N): Applies a template to each input entity individually. Each entity becomes an independent context, and you get one output per input.

**Reduce mode** (N -> 1): Aggregates all input entities into a single output. This is perfect for generating index files, summaries, or any content that combines multiple entities.

Templates use the full Handlebars syntax including helpers, conditionals, and iteration.

# Usage

## Mode Selection

- `template.mode` = `map` (default) | `reduce`

## Map Mode (N -> N)

- `template.content` = Handlebars template string
- `template.output` = Attribute name to store result (default: `value.string`)

The template context is the entity's attrs directly. Access attributes with `{{name}}`, `{{role}}`, etc.

## Reduce Mode (N -> 1)

- `template.reduce.template` = Handlebars template for aggregation
- `template.reduce.output` = Attribute name for result (default: `content`)
- `template.reduce.name` = Name for the single output entity (default: `generated`)

The template context provides:
- `items` - Array of all input entities (access attrs via `{{attrs.name}}`)
- `count` - Number of input entities
- `first` - First entity
- `last` - Last entity

## Built-in Helpers

- `{{json value}}` - JSON stringify with formatting
- `{{join array separator}}` - Join array with separator

# Examples

## Generate TypeScript interface (Map mode)

```
template.mode = map
template.content = interface {{name}} {
  id: string;
  type: '{{role}}';
}
template.output = code
```

## Generate barrel export (Reduce mode)

```
template.mode = reduce
template.reduce.template = {{#each items}}
export * from './{{attrs.name}}'
{{/each}}
template.reduce.output = content
template.reduce.name = index
```

## Generate component list (Reduce mode)

```
template.mode = reduce
template.reduce.template = # Components ({{count}})

{{#each items}}
- **{{attrs.name}}**: {{attrs.description}}
{{/each}}
template.reduce.output = markdown
template.reduce.name = component-list
```

## Conditional content (Map mode)

```
template.content = {{#if deprecated}}
// @deprecated
{{/if}}
export const {{name}} = '{{value}}'
```

## JSON output (Reduce mode)

```
template.reduce.template = {
  "components": [
    {{#each items}}
    "{{attrs.name}}"{{#unless @last}},{{/unless}}
    {{/each}}
  ],
  "count": {{count}}
}
```
