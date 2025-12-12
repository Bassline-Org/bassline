# @bassline/structure-editor

Tiptap-based structural JSON editor.

## Overview

A rich text editor that provides structural JSON editing:

- **Commands** - `/object` and `/array` commands for creating structures
- **Navigation** - Tab navigation between fields
- **Validation** - Automatic structure validation
- **Serialization** - JSON to Tiptap and back

## Installation

```bash
pnpm add @bassline/structure-editor
```

## Usage

### JavaScript API

```javascript
import { createStructureEditor } from '@bassline/structure-editor'

const container = document.getElementById('editor')

const editor = createStructureEditor(container, {
  content: { name: 'Alice', age: 30 },
  onChange: (json) => console.log('Updated:', json),
  onReady: (editor) => console.log('Editor ready'),
  readonly: false,
  placeholder: 'Type / for commands...',
})

// Get current JSON
const json = editor.getJson()

// Set JSON content
editor.setJson({ items: [1, 2, 3] })

// Focus the editor
editor.focus()

// Cleanup
editor.destroy()
```

### Solid Component

```jsx
import { StructureEditorComponent } from '@bassline/structure-editor'

function JsonEditor() {
  const [value, setValue] = createSignal({ count: 0 })

  return (
    <StructureEditorComponent
      content={value()}
      onChange={setValue}
      placeholder="Type / for commands..."
    />
  )
}
```

## Commands

Type `/` to trigger the command palette:

| Command   | Description               |
| --------- | ------------------------- |
| `/object` | Insert a JSON object `{}` |
| `/array`  | Insert a JSON array `[]`  |

Commands can be customized via the `onShowPalette` callback:

```javascript
createStructureEditor(element, {
  onShowPalette: (query, commands) => {
    // Show custom UI with filtered commands
    showPalette(commands.filter((c) => c.name.includes(query)))
  },
  onHidePalette: () => {
    // Hide custom UI
    hidePalette()
  },
})
```

## Serialization

Convert between JSON and Tiptap document format:

```javascript
import { jsonToTiptap, tiptapToJson, wrapInDocument } from '@bassline/structure-editor'

// JSON → Tiptap node
const tiptapNode = jsonToTiptap({ name: 'Alice', items: [1, 2] })

// Tiptap node → JSON
const json = tiptapToJson(tiptapNode)

// Wrap in document structure
const doc = wrapInDocument(tiptapNode)
// → { type: 'doc', content: [tiptapNode] }

// Create empty structures
import { createEmptyObject, createEmptyArray } from '@bassline/structure-editor'
const emptyObj = createEmptyObject()
const emptyArr = createEmptyArray()
```

## Extensions

The editor uses custom Tiptap extensions for JSON structure:

| Extension       | Description                                      |
| --------------- | ------------------------------------------------ |
| `JsonDocument`  | Root document node                               |
| `JsonObject`    | Object container `{ }`                           |
| `JsonArray`     | Array container `[ ]`                            |
| `JsonPair`      | Key-value pair in objects                        |
| `JsonElement`   | Element in arrays                                |
| `JsonKey`       | Object key                                       |
| `JsonValue`     | Any JSON value container                         |
| `JsonPrimitive` | Primitive values (string, number, boolean, null) |
| `CommandPrefix` | `/` command system                               |

Access extensions for custom configurations:

```javascript
import {
  JsonDocument,
  JsonObject,
  JsonArray,
  JsonPair,
  JsonKey,
  JsonValue,
  JsonPrimitive,
  CommandPrefix,
} from '@bassline/structure-editor'
```

## Types

```typescript
interface StructureEditorOptions {
  content?: JsonValue
  onChange?: (json: JsonValue) => void
  onReady?: (editor: Editor) => void
  readonly?: boolean
  placeholder?: string
  onShowPalette?: (query: string, commands: StructureCommand[]) => void
  onHidePalette?: () => void
}

interface StructureEditor {
  editor: Editor // Tiptap editor instance
  getJson: () => JsonValue
  setJson: (json: JsonValue) => void
  focus: () => void
  destroy: () => void
}

interface StructureCommand {
  name: string
  description: string
  execute: () => void
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
```

## Exports

```javascript
// Core
export { createStructureEditor, default as createEditor } from './core/createStructureEditor'

// Types
export type { JsonValue, TiptapJsonNode, StructureCommand, StructureEditorOptions, StructureEditor }

// Serialization
export { jsonToTiptap, tiptapToJson, createEmptyObject, createEmptyArray, wrapInDocument }

// Extensions
export * from './extensions'

// Components (Solid)
export { StructureEditor as StructureEditorComponent }
export type { StructureEditorProps }
```
