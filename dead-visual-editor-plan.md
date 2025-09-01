# Dead Visual Editor - Comprehensive Claude Code Plan

## Critical Instructions for Claude Code
⚠️ **WRITE TERSE CODE**: Use minimal, concise syntax. Avoid verbose patterns. Prefer single-line functions, destructuring, and compact expressions. No unnecessary comments or whitespace.

## Project Overview
Build a React Flow-based visual editor that exports flat JSON IR for propagation networks. Dead compilation only - no live execution in editor.

## 1. Project Setup & Dependencies

### Initial Setup
```bash
# Create React app with Vite (faster than CRA)
npm create vite@latest propagator-editor -- --template react-ts
cd propagator-editor
```

### Dependencies
```bash
npm install @xyflow/react lucide-react clsx
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Package.json Scripts (add these)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build", 
    "preview": "vite preview",
    "export": "node scripts/export-example.js"
  }
}
```

## 2. File Structure (Complete)
```
src/
├── components/
│   ├── nodes/
│   │   ├── CellNode.tsx           # Cell node component
│   │   ├── PropagatorNode.tsx     # Propagator node component  
│   │   └── index.ts               # Node exports
│   ├── ui/
│   │   ├── NodePalette.tsx        # Drag-and-drop palette
│   │   ├── ExportPanel.tsx        # JSON export controls
│   │   ├── FunctionSelector.tsx   # Dropdown for functions
│   │   └── index.ts               # UI exports
│   └── Editor.tsx                 # Main editor component
├── lib/
│   ├── types.ts                   # TypeScript interfaces
│   ├── functions.ts               # Available merge/prop functions
│   ├── export.ts                  # IR export logic
│   ├── validation.ts              # Graph validation
│   └── constants.ts               # Node types, defaults
├── runtime/                       # Separate from editor 
│   ├── PropagationRuntime.ts      # Runtime execution
│   ├── Cell.ts                    # Cell implementation
│   ├── Propagator.ts              # Propagator implementation
│   └── index.ts                   # Runtime exports
├── styles/
│   ├── globals.css                # Tailwind + global styles
│   └── nodes.css                  # Node-specific styles
├── examples/
│   ├── simple-network.json        # Example IR files
│   ├── temperature-control.json   
│   └── bounds-checking.json
├── scripts/
│   └── export-example.js          # Node.js script to test IR
├── App.tsx                        # Root component
├── main.tsx                       # Entry point
└── vite-env.d.ts                  # Vite types
```

## 3. TypeScript Interfaces (lib/types.ts)
```typescript
// IR Format - Final output
export interface PropagationIR {
  cells: CellDefinition[]
  propagators: PropagatorDefinition[]
  metadata?: { created: string; version: string }
}

export interface CellDefinition {
  id: string
  merge_fn: string
  initial?: any
  position: { x: number; y: number }
}

export interface PropagatorDefinition {
  id: string
  fn: string
  inputs: string[]
  outputs: string[]
  position: { x: number; y: number }
}

// React Flow Node Data
export interface CellNodeData {
  label: string
  merge_fn: string
  initial?: any
  onChange: (field: string, value: any) => void
}

export interface PropagatorNodeData {
  label: string
  fn: string
  onChange: (field: string, value: any) => void
}

// Function Registry
export interface FunctionDef {
  id: string
  name: string
  description: string
  inputs: number
  outputs: number
}
```

## 4. Function Registry (lib/functions.ts)
```typescript
import { FunctionDef } from './types'

export const MERGE_FUNCTIONS: FunctionDef[] = [
  { id: 'std.max', name: 'Max', description: 'Take maximum value', inputs: -1, outputs: 1 },
  { id: 'std.sum', name: 'Sum', description: 'Sum all values', inputs: -1, outputs: 1 },
  { id: 'std.first', name: 'First', description: 'Take first value', inputs: -1, outputs: 1 },
  { id: 'std.last', name: 'Last', description: 'Take last value', inputs: -1, outputs: 1 },
  { id: 'std.avg', name: 'Average', description: 'Average of values', inputs: -1, outputs: 1 }
]

export const PROPAGATOR_FUNCTIONS: FunctionDef[] = [
  { id: 'std.add', name: 'Add', description: 'Add two numbers', inputs: 2, outputs: 1 },
  { id: 'std.sub', name: 'Subtract', description: 'Subtract numbers', inputs: 2, outputs: 1 },
  { id: 'std.mul', name: 'Multiply', description: 'Multiply numbers', inputs: 2, outputs: 1 },
  { id: 'std.div', name: 'Divide', description: 'Divide numbers', inputs: 2, outputs: 1 },
  { id: 'std.clamp', name: 'Clamp', description: 'Clamp to range', inputs: 3, outputs: 1 },
  { id: 'std.gt', name: 'Greater Than', description: 'Compare values', inputs: 2, outputs: 1 },
  { id: 'std.lt', name: 'Less Than', description: 'Compare values', inputs: 2, outputs: 1 },
  { id: 'std.eq', name: 'Equals', description: 'Check equality', inputs: 2, outputs: 1 }
]

export const getAllFunctions = () => [...MERGE_FUNCTIONS, ...PROPAGATOR_FUNCTIONS]
export const getMergeFunctions = () => MERGE_FUNCTIONS
export const getPropagatorFunctions = () => PROPAGATOR_FUNCTIONS
```

## 5. Node Components

### CellNode Component (components/nodes/CellNode.tsx)
```typescript
import { Handle, Position, NodeProps } from '@xyflow/react'
import { FunctionSelector } from '../ui/FunctionSelector'
import { CellNodeData } from '../../lib/types'
import { getMergeFunctions } from '../../lib/functions'

export function CellNode({ data }: NodeProps<CellNodeData>) {
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 min-w-48">
      <div className="font-medium text-blue-900 mb-2">Cell: {data.label}</div>
      
      <FunctionSelector
        value={data.merge_fn}
        functions={getMergeFunctions()}
        onChange={(v) => data.onChange('merge_fn', v)}
        placeholder="Select merge function"
      />
      
      <div className="mt-2">
        <input
          type="text"
          placeholder="Initial value (optional)"
          className="w-full text-xs p-1 border rounded"
          onChange={(e) => data.onChange('initial', e.target.value || null)}
        />
      </div>
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-400" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-400" />
    </div>
  )
}
```

### PropagatorNode Component (components/nodes/PropagatorNode.tsx)
```typescript
import { Handle, Position, NodeProps } from '@xyflow/react'
import { FunctionSelector } from '../ui/FunctionSelector'
import { PropagatorNodeData } from '../../lib/types'
import { getPropagatorFunctions } from '../../lib/functions'

export function PropagatorNode({ data }: NodeProps<PropagatorNodeData>) {
  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 min-w-48">
      <div className="font-medium text-green-900 mb-2">Prop: {data.label}</div>
      
      <FunctionSelector
        value={data.fn}
        functions={getPropagatorFunctions()}
        onChange={(v) => data.onChange('fn', v)}
        placeholder="Select function"
      />
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-green-400" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-400" />
    </div>
  )
}
```

## 6. UI Components

### FunctionSelector (components/ui/FunctionSelector.tsx)
```typescript
import { FunctionDef } from '../../lib/types'

interface Props {
  value: string
  functions: FunctionDef[]
  onChange: (value: string) => void
  placeholder: string
}

export function FunctionSelector({ value, functions, onChange, placeholder }: Props) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs p-1 border rounded bg-white"
    >
      <option value="">{placeholder}</option>
      {functions.map(fn => (
        <option key={fn.id} value={fn.id} title={fn.description}>
          {fn.name}
        </option>
      ))}
    </select>
  )
}
```

### NodePalette (components/ui/NodePalette.tsx)
```typescript
import { DragEvent } from 'react'

export function NodePalette() {
  const onDragStart = (e: DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border z-10">
      <h3 className="font-medium mb-3">Nodes</h3>
      
      <div 
        className="bg-blue-100 p-2 rounded mb-2 cursor-grab text-sm"
        draggable
        onDragStart={(e) => onDragStart(e, 'cell')}
      >
        📦 Cell
      </div>
      
      <div 
        className="bg-green-100 p-2 rounded cursor-grab text-sm"
        draggable
        onDragStart={(e) => onDragStart(e, 'propagator')}
      >
        ⚡ Propagator
      </div>
    </div>
  )
}
```

### ExportPanel (components/ui/ExportPanel.tsx)
```typescript
import { Node, Edge } from '@xyflow/react'
import { Download, Play } from 'lucide-react'
import { exportToIR } from '../../lib/export'

interface Props {
  nodes: Node[]
  edges: Edge[]
}

export function ExportPanel({ nodes, edges }: Props) {
  const handleExport = () => {
    const ir = exportToIR(nodes, edges)
    const blob = new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'network.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = () => {
    const ir = exportToIR(nodes, edges)
    navigator.clipboard.writeText(JSON.stringify(ir, null, 2))
  }

  return (
    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-10">
      <h3 className="font-medium mb-3">Export</h3>
      
      <button 
        onClick={handleExport}
        className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded text-sm mb-2 w-full"
      >
        <Download size={14} /> Download JSON
      </button>
      
      <button 
        onClick={handleCopy}
        className="flex items-center gap-2 bg-gray-500 text-white px-3 py-1 rounded text-sm w-full"
      >
        <Play size={14} /> Copy to Clipboard
      </button>
    </div>
  )
}
```

## 7. Export Logic (lib/export.ts)
```typescript
import { Node, Edge } from '@xyflow/react'
import { PropagationIR, CellDefinition, PropagatorDefinition } from './types'

export function exportToIR(nodes: Node[], edges: Edge[]): PropagationIR {
  const cells: CellDefinition[] = nodes
    .filter(n => n.type === 'cell')
    .map(n => ({
      id: n.id,
      merge_fn: n.data.merge_fn || '',
      initial: n.data.initial,
      position: n.position
    }))

  const propagators: PropagatorDefinition[] = nodes
    .filter(n => n.type === 'propagator')
    .map(n => {
      const inputs = edges
        .filter(e => e.target === n.id)
        .map(e => e.source)
      
      const outputs = edges
        .filter(e => e.source === n.id)
        .map(e => e.target)

      return {
        id: n.id,
        fn: n.data.fn || '',
        inputs,
        outputs,
        position: n.position
      }
    })

  return {
    cells,
    propagators,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0'
    }
  }
}
```

## 8. Validation (lib/validation.ts)
```typescript
import { Node, Edge } from '@xyflow/react'

export interface ValidationError {
  type: 'error' | 'warning'
  message: string
  nodeId?: string
}

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = []

  // Check for nodes without functions
  nodes.forEach(node => {
    if (node.type === 'cell' && !node.data.merge_fn) {
      errors.push({
        type: 'error',
        message: `Cell ${node.data.label} missing merge function`,
        nodeId: node.id
      })
    }
    
    if (node.type === 'propagator' && !node.data.fn) {
      errors.push({
        type: 'error', 
        message: `Propagator ${node.data.label} missing function`,
        nodeId: node.id
      })
    }
  })

  // Check for disconnected nodes
  const connectedNodes = new Set([...edges.map(e => e.source), ...edges.map(e => e.target)])
  nodes.forEach(node => {
    if (!connectedNodes.has(node.id)) {
      errors.push({
        type: 'warning',
        message: `Node ${node.data.label} is not connected`,
        nodeId: node.id
      })
    }
  })

  return errors
}
```

## 9. Main Editor Component (components/Editor.tsx)
```typescript
import { useCallback, useState, DragEvent } from 'react'
import { ReactFlow, Background, Controls, Node, Edge, useNodesState, useEdgesState, addEdge, NodeTypes } from '@xyflow/react'
import { CellNode } from './nodes/CellNode'
import { PropagatorNode } from './nodes/PropagatorNode'
import { NodePalette } from './ui/NodePalette'
import { ExportPanel } from './ui/ExportPanel'

let nodeId = 0
const getId = () => `node_${nodeId++}`

const nodeTypes: NodeTypes = {
  cell: CellNode,
  propagator: PropagatorNode
}

export function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = useCallback(
    (params: any) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow')
    if (!type) return

    const position = { x: e.clientX - 200, y: e.clientY - 100 }
    const id = getId()
    const label = `${type}_${id.split('_')[1]}`

    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label,
        [type === 'cell' ? 'merge_fn' : 'fn']: '',
        onChange: (field: string, value: any) => {
          setNodes(nodes => nodes.map(n => 
            n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
          ))
        }
      }
    }

    setNodes(nodes => [...nodes, newNode])
  }, [setNodes])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="h-screen w-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      <NodePalette />
      <ExportPanel nodes={nodes} edges={edges} />
    </div>
  )
}
```

## 10. Runtime Implementation (runtime/PropagationRuntime.ts)
```typescript
import { PropagationIR } from '../lib/types'
import { Cell } from './Cell'
import { Propagator } from './Propagator'

export class PropagationRuntime {
  private cells = new Map<string, Cell>()
  private propagators = new Map<string, Propagator>()

  loadNetwork(ir: PropagationIR) {
    // Create cells
    ir.cells.forEach(cellDef => {
      const cell = new Cell(cellDef.merge_fn, cellDef.initial)
      this.cells.set(cellDef.id, cell)
    })

    // Create propagators
    ir.propagators.forEach(propDef => {
      const inputs = propDef.inputs.map(id => this.cells.get(id)!).filter(Boolean)
      const outputs = propDef.outputs.map(id => this.cells.get(id)!).filter(Boolean)
      const prop = new Propagator(propDef.fn, inputs, outputs)
      this.propagators.set(propDef.id, prop)
    })
  }

  emit(cellId: string, value: any) {
    const cell = this.cells.get(cellId)
    if (cell) {
      cell.addValue(value)
      this.propagate()
    }
  }

  private propagate() {
    // Simple propagation - run all propagators once
    this.propagators.forEach(prop => prop.run())
  }

  getCell(id: string) { return this.cells.get(id) }
  getCellValue(id: string) { return this.cells.get(id)?.getValue() }
}
```

## 11. Example Usage Script (scripts/export-example.js)
```javascript
const fs = require('fs')
const { PropagationRuntime } = require('../dist/runtime')

// Load example network
const networkJson = JSON.parse(fs.readFileSync('../examples/simple-network.json', 'utf8'))

// Create runtime and load network
const runtime = new PropagationRuntime()
runtime.loadNetwork(networkJson)

// Test the network
runtime.emit('input1', 42)
runtime.emit('input2', 10)

console.log('Result:', runtime.getCellValue('output'))
```

## 12. Styling (styles/globals.css)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@xyflow/react/dist/style.css';

.react-flow__node {
  font-size: 12px;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
}
```

## 13. Example IR Files (examples/simple-network.json)
```json
{
  "cells": [
    {
      "id": "input1", 
      "merge_fn": "std.first",
      "position": {"x": 0, "y": 0},
      "initial": null
    },
    {
      "id": "input2",
      "merge_fn": "std.first", 
      "position": {"x": 0, "y": 100},
      "initial": null
    },
    {
      "id": "output",
      "merge_fn": "std.first",
      "position": {"x": 300, "y": 50}, 
      "initial": null
    }
  ],
  "propagators": [
    {
      "id": "adder",
      "fn": "std.add",
      "inputs": ["input1", "input2"],
      "outputs": ["output"],
      "position": {"x": 150, "y": 50}
    }
  ],
  "metadata": {
    "created": "2025-08-27T12:00:00Z",
    "version": "1.0.0"
  }
}
```

## 14. Build & Development
- **Dev**: `npm run dev` - Start development server
- **Build**: `npm run build` - Build for production  
- **Test Export**: `npm run export` - Test runtime with example
- **Preview**: `npm run preview` - Preview built app

## 15. Success Criteria
✅ Drag-and-drop node creation from palette  
✅ Visual connection between nodes  
✅ Function selection dropdowns work  
✅ Export generates valid flat JSON IR  
✅ Runtime can load and execute exported networks  
✅ Validation catches common errors  
✅ Clean, minimal codebase (prefer terse syntax)

## 16. Key Implementation Notes
- **Keep React Flow simple**: Just visual editing, no computation
- **Flat IR only**: No nested structures, no macros
- **Terse code**: Single-line functions, minimal boilerplate
- **TypeScript strict**: Full type safety
- **No external state**: React Flow manages its own state
- **Direct JSON export**: No intermediate compilation steps

This plan creates a production-ready dead visual editor in ~500 lines of terse TypeScript code.