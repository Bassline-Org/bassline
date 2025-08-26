/**
 * ReteNetworkEditor - Main Rete.js editor component for propagation networks
 * 
 * This component:
 * - Creates and manages a Rete editor instance
 * - Syncs with a propagation Network
 * - Handles visual node creation and connections
 * - Provides a palette for adding gadgets
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { NodeEditor, ClassicPreset } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { ReactPlugin, Presets as ReactPresets, useRete, type ReactArea2D } from 'rete-react-plugin'

import type { BasslineEngine } from 'proper-bassline/src/engine'
import type { Gadget } from 'proper-bassline/src/gadget'
import { Cell } from 'proper-bassline/src/cell'
import { FunctionGadget } from 'proper-bassline/src/function'
import { OrdinalCell, MaxCell, MinCell, UnionCell } from 'proper-bassline/src/cells/basic'
import { ExtractValue } from 'proper-bassline/src/functions/extract'
import { AddFunction, MultiplyFunction } from 'proper-bassline/src/functions/basic'

import { PropagationNetworkPlugin } from './plugins/PropagationNetworkPlugin'
import { CellNode, FunctionNode, type BasslineSchemes, type Node } from './nodes'

interface ReteNetworkEditorProps {
  engine: BasslineEngine
  className?: string
}

export const createEditor = (engine: BasslineEngine) => async (el: HTMLElement) => {
  const editor = new NodeEditor<BasslineSchemes>()
  const areaPlugin = new AreaPlugin<BasslineSchemes, ReactArea2D<BasslineSchemes>>(el)
  const connectionPlugin = new ConnectionPlugin<BasslineSchemes, ReactArea2D<BasslineSchemes>>()
  const render = new ReactPlugin<BasslineSchemes, ReactArea2D<BasslineSchemes>>({ createRoot });
  const propagationPlugin = new PropagationNetworkPlugin(engine, editor)

  editor.use(areaPlugin)
  areaPlugin.use(render)
  areaPlugin.use(connectionPlugin)
  
  // Set area plugin on propagation plugin
  propagationPlugin.setArea(areaPlugin)

  render.addPreset(ReactPresets.classic.setup<BasslineSchemes, ReactArea2D<BasslineSchemes>>())
  
  // Setup connections
  connectionPlugin.addPreset(ConnectionPresets.classic.setup())
  
  // Enable zoom/pan controls
  await AreaExtensions.zoomAt(areaPlugin, editor.getNodes())
  AreaExtensions.selectableNodes(areaPlugin, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() })

  // Return the editor with additional properties
  return Object.assign(editor, {
    area: areaPlugin,
    destroy() {
      propagationPlugin.destroy()
    }
  })
}

export async function createNodeForGadget(gadget: Gadget, editor: NodeEditor<BasslineSchemes>): Promise<Node | null> {
  let node: Node | null = null
  
  if (gadget instanceof Cell) {
    node = new CellNode(gadget)
  } else if (gadget instanceof FunctionGadget) {
    node = new FunctionNode(gadget)
  } else {
    console.warn(`Unsupported gadget type: ${gadget.constructor.name}`)
  }

  if (node) {
    await editor.addNode(node)
  }

  return node
}

export function ReteNetworkEditor({ engine, className = '' }: ReteNetworkEditorProps) {
  // Create the editor factory function only once using useCallback
  const createEditorFactory = useCallback(createEditor(engine), [engine])
  const [ref, editor] = useRete(createEditorFactory);
  const [area, setArea] = useState<AreaPlugin<BasslineSchemes, ReactArea2D<BasslineSchemes>> | null>(null)
  
  useEffect(() => {
    if (editor && 'area' in editor) {
      setArea((editor as any).area)
    }
  }, [editor])
  
  const addGadget = async (type: string) => {
    if (!editor || !area) return
    
    let gadget: Gadget | null = null
    const id = `${type.toLowerCase()}-${Date.now()}`
    
    switch (type) {
      case 'OrdinalCell':
        gadget = new OrdinalCell(id)
        break
      case 'MaxCell':
        gadget = new MaxCell(id)
        break
      case 'MinCell':
        gadget = new MinCell(id)
        break
      case 'UnionCell':
        gadget = new UnionCell(id)
        break
      case 'ExtractValue':
        gadget = new ExtractValue(id)
        break
      case 'AddFunction':
        gadget = new AddFunction(id)
        break
      case 'MultiplyFunction':
        gadget = new MultiplyFunction(id)
        break
      default:
        console.warn(`Unknown gadget type: ${type}`)
        return
    }
    
    if (gadget) {
      // Add to engine
      engine.add(gadget)
      
      // Create node for gadget
      const node = await createNodeForGadget(gadget, editor)
      
      if (node && area) {
        // Position randomly for now
        await area.translate(node.id, {
          x: Math.random() * 600 + 100,
          y: Math.random() * 400 + 100
        })
      }
    }
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Gadget Palette */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-sm font-semibold mb-2">Add Gadgets</h3>
        
        <div className="mb-3">
          <h4 className="text-xs font-medium text-gray-600 mb-1">Cells</h4>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => addGadget('OrdinalCell')}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Ordinal Cell
            </button>
            <button
              onClick={() => addGadget('MaxCell')}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Max Cell
            </button>
            <button
              onClick={() => addGadget('MinCell')}
              className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
            >
              Min Cell
            </button>
            <button
              onClick={() => addGadget('UnionCell')}
              className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
            >
              Union Cell
            </button>
          </div>
        </div>
        
        <div>
          <h4 className="text-xs font-medium text-gray-600 mb-1">Functions</h4>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => addGadget('ExtractValue')}
              className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
            >
              Extract Value
            </button>
            <button
              onClick={() => addGadget('AddFunction')}
              className="px-3 py-1 bg-pink-500 text-white rounded hover:bg-pink-600 text-sm"
            >
              Add (+)
            </button>
            <button
              onClick={() => addGadget('MultiplyFunction')}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              Multiply (×)
            </button>
          </div>
        </div>
      </div>
      
      {/* Rete Editor Container */}
      <div
        ref={ref}
        className="w-full h-full bg-gray-50"
        style={{ position: 'relative' }}
      />
    </div>
  )
}