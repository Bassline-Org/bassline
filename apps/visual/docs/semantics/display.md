---
id: display
name: Display
summary: Visualize entity data in table, code, JSON, or list format
---

# Description

The Display semantic renders input entities in various formats for viewing, debugging, and exporting. It's the visual endpoint of a semantic pipeline.

Display supports four view types:
- **Table**: Spreadsheet-like view with configurable columns
- **Code**: Syntax-highlighted code from an attribute
- **JSON**: Raw JSON export of entity data
- **List**: Simple bulleted list with custom labels

It also supports two input modes:
- **Output**: Shows output entities from bound semantics (for composition)
- **Direct**: Shows bound entities directly, even semantic entities (for debugging)

# Usage

## View Selection

- `display.view` = `table` (default) | `code` | `json` | `list`

## Input Mode

- `display.mode` = `output` (default) | `direct`

## Table View Options

- `display.columns` = Comma-separated column names (auto-detected if empty)

## Code View Options

- `display.attr` = Attribute containing the code (default: `value.string`)
- `display.language` = Language for syntax hints (default: `text`)

## JSON View Options

- `display.scope` = `attrs` (default) | `full`
  - `attrs`: Only entity attributes
  - `full`: Complete entity including id, timestamps

## List View Options

- `display.label` = Label template with `{{attr}}` placeholders

# Examples

## Show entities in a table

```
display.view = table
display.columns = name,role,status
```

## Auto-detect columns

```
display.view = table
display.columns =
```

## Display generated code

```
display.view = code
display.attr = code
display.language = typescript
```

## Export as JSON

```
display.view = json
display.scope = attrs
```

## Custom list format

```
display.view = list
display.label = {{name}} ({{role}}) - {{status}}
```

## Debug semantic output

```
display.view = json
display.mode = direct
display.scope = full
```

## Show template results

```
display.view = code
display.attr = content
display.language = markdown
```
