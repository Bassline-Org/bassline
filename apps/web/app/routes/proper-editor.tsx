/**
 * Proper Bassline Visual Editor
 * A visual editor for creating and manipulating propagation networks
 */

import { useState, useCallback } from 'react'
import { NetworkProvider } from 'proper-bassline-react'
import { Canvas } from 'proper-bassline-react/src/components/Canvas'
import { NodeRenderer } from 'proper-bassline-react/src/components/NodeRenderer'
import { Edges } from 'proper-bassline-react/src/components/EdgeRenderer'
import { Network } from 'proper-bassline/src/network'
import { VisualNode } from 'proper-bassline/src/visual-node'
import { OrdinalCell, MaxCell, MinCell, SetCell } from 'proper-bassline/src/cells/basic'
import { FunctionGadget } from 'proper-bassline/src/function'
import { num, str, bool, getMapValue, ordinalValue, getOrdinal } from 'proper-bassline/src/types'
import type { LatticeValue } from 'proper-bassline/src/types'

// Temperature converter functions from our demo
class CelsiusToFahrenheit extends FunctionGadget {
  constructor(id: string) {
    super(id, ['celsius'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.celsius
    if (!input) return num(32)
    
    const value = getMapValue(input)
    const ordinal = getOrdinal(input)
    
    if (!value || value.type !== 'number') return num(32)
    
    const fahrenheit = value.value * 9/5 + 32
    
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(fahrenheit))
    }
    return num(fahrenheit)
  }
}

interface EditorEdge {
  id: string
  source: VisualNode
  target: VisualNode
  sourceOutput?: string
  targetInput?: string
}

export default function ProperEditor() {
  const [mainNetwork] = useState(() => new Network('editor'))
  const [nodes, setNodes] = useState<VisualNode[]>([])
  const [edges, setEdges] = useState<EditorEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [connectionStart, setConnectionStart] = useState<{
    nodeId: string
    outputName?: string
  } | null>(null)
  const [savedNetworks, setSavedNetworks] = useState<Record<string, any>>(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('bassline-saved-networks')
    return saved ? JSON.parse(saved) : {}
  })
  
  // Create a new node
  const createNode = useCallback((type: string, x: number, y: number) => {
    let content: any
    let node: VisualNode
    
    switch (type) {
      case 'ordinal':
        content = new OrdinalCell(`cell-${nodes.length}`)
        break
      case 'max':
        content = new MaxCell(`max-${nodes.length}`)
        break
      case 'min':
        content = new MinCell(`min-${nodes.length}`)
        break
      case 'set':
        content = new SetCell(`set-${nodes.length}`)
        break
      case 'celsius-to-fahrenheit':
        content = new CelsiusToFahrenheit(`c2f-${nodes.length}`)
        break
      default:
        content = new OrdinalCell(`cell-${nodes.length}`)
    }
    
    node = new VisualNode(`node-${nodes.length}`, content)
    node.setPosition(x, y)
    
    mainNetwork.add(node)
    setNodes(prev => [...prev, node])
    
    return node
  }, [nodes.length, mainNetwork])
  
  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    
    // Update selection state in nodes
    nodes.forEach(node => {
      node.setSelected(node.id === nodeId)
    })
  }, [nodes])
  
  // Handle connection creation
  const handleConnectionStart = useCallback((nodeId: string, outputName?: string) => {
    setConnectionStart({ nodeId, outputName })
  }, [])
  
  const handleConnectionEnd = useCallback((nodeId: string, inputName?: string) => {
    if (!connectionStart) return
    
    const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
    const targetNode = nodes.find(n => n.id === nodeId)
    
    if (!sourceNode || !targetNode || sourceNode === targetNode) {
      setConnectionStart(null)
      return
    }
    
    // Create connection in the propagation network
    if (targetNode.content && sourceNode.content) {
      if ('connectFrom' in targetNode.content) {
        (targetNode.content as any).connectFrom(
          sourceNode.content,
          connectionStart.outputName || 'default'
        )
      }
    }
    
    // Add edge for visualization
    const edge: EditorEdge = {
      id: `edge-${edges.length}`,
      source: sourceNode,
      target: targetNode,
      sourceOutput: connectionStart.outputName,
      targetInput: inputName
    }
    
    setEdges(prev => [...prev, edge])
    setConnectionStart(null)
  }, [connectionStart, nodes, edges.length])
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // If we're in connection mode, cancel it
    if (connectionStart) {
      setConnectionStart(null)
      return
    }
    
    // Otherwise deselect all nodes
    setSelectedNodeId(null)
    nodes.forEach(node => node.setSelected(false))
  }, [connectionStart, nodes])
  
  // Save current network
  const saveNetwork = useCallback((name: string) => {
    const serialized = mainNetwork.serialize()
    
    // Add metadata
    const saveData = {
      ...serialized,
      timestamp: Date.now(),
      name,
      // Include visual nodes and edges
      visualNodes: nodes.map(n => n.serialize()),
      visualEdges: edges.map(e => ({
        id: e.id,
        sourceId: e.source.id,
        targetId: e.target.id,
        sourceOutput: e.sourceOutput,
        targetInput: e.targetInput
      }))
    }
    
    // Save to localStorage
    const newSaved = { ...savedNetworks, [name]: saveData }
    setSavedNetworks(newSaved)
    localStorage.setItem('bassline-saved-networks', JSON.stringify(newSaved))
    
    console.log('Saved network:', name, saveData)
  }, [mainNetwork, nodes, edges, savedNetworks])
  
  // Load a saved network
  const loadNetwork = useCallback((name: string) => {
    const saveData = savedNetworks[name]
    if (!saveData) {
      console.error('Network not found:', name)
      return
    }
    
    console.log('Loading network:', name, saveData)
    
    // TODO: Implement deserialization
    // For now, just log
    alert(`Loading ${name} - deserialization not yet implemented`)
  }, [savedNetworks])
  
  // Download network as JSON
  const downloadNetwork = useCallback(() => {
    const serialized = mainNetwork.serialize()
    const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [mainNetwork])
  
  // Upload network from JSON
  const uploadNetwork = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          console.log('Uploaded network:', data)
          // TODO: Implement deserialization
          alert('Upload successful - deserialization not yet implemented')
        } catch (err) {
          console.error('Failed to parse JSON:', err)
          alert('Failed to parse JSON file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])
  
  return (
    <NetworkProvider network={mainNetwork}>
      <div className="w-screen h-screen flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Gadget Palette</h2>
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600 mt-4">Cells</h3>
            <button
              className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => createNode('ordinal', 100, 100)}
            >
              📝 Ordinal Cell
            </button>
            <button
              className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => createNode('max', 100, 200)}
            >
              ⬆️ Max Cell
            </button>
            <button
              className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => createNode('min', 100, 300)}
            >
              ⬇️ Min Cell
            </button>
            <button
              className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => createNode('set', 100, 400)}
            >
              🗂️ Set Cell
            </button>
            
            <h3 className="text-sm font-semibold text-gray-600 mt-4">Functions</h3>
            <button
              className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => createNode('celsius-to-fahrenheit', 300, 100)}
            >
              🌡️ C→F Converter
            </button>
          </div>
          
          {/* Connection status */}
          {connectionStart && (
            <div className="mt-6 p-3 bg-blue-50 rounded">
              <div className="text-sm font-medium">Connecting from:</div>
              <div className="text-sm">{connectionStart.nodeId}</div>
              <div className="text-xs text-gray-600 mt-1">
                Click an input to complete connection
              </div>
            </div>
          )}
          
          {/* Selected node info */}
          {selectedNodeId && (
            <div className="mt-6 p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium">Selected:</div>
              <div className="text-sm">{selectedNodeId}</div>
            </div>
          )}
          
          {/* Save/Load Controls */}
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Save/Load</h3>
            
            <div className="space-y-2">
              <button
                className="w-full text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm"
                onClick={() => {
                  const name = prompt('Enter network name:')
                  if (name) saveNetwork(name)
                }}
              >
                💾 Save Network
              </button>
              
              <button
                className="w-full text-left px-3 py-2 bg-green-100 hover:bg-green-200 rounded text-sm"
                onClick={downloadNetwork}
              >
                ⬇️ Download JSON
              </button>
              
              <button
                className="w-full text-left px-3 py-2 bg-green-100 hover:bg-green-200 rounded text-sm"
                onClick={uploadNetwork}
              >
                ⬆️ Upload JSON
              </button>
            </div>
            
            {/* Saved networks list */}
            {Object.keys(savedNetworks).length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-600 mb-1">Saved Networks:</div>
                <div className="space-y-1">
                  {Object.keys(savedNetworks).map(name => (
                    <button
                      key={name}
                      className="w-full text-left px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                      onClick={() => loadNetwork(name)}
                    >
                      📁 {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Main canvas */}
        <div className="flex-1">
          <Canvas onCanvasClick={handleCanvasClick}>
            {/* Render edges */}
            <Edges edges={edges} />
            
            {/* Render nodes */}
            {nodes.map(node => (
              <NodeRenderer
                key={node.id}
                node={node}
                onSelect={handleNodeSelect}
                onConnectionStart={handleConnectionStart}
                onConnectionEnd={handleConnectionEnd}
              >
                {/* Custom content based on gadget type */}
                {node.content && (
                  <div className="text-sm">
                    <div className="font-medium mb-1">{node.content.constructor.name}</div>
                    <div className="text-xs text-gray-600">
                      Value: {JSON.stringify(
                        getMapValue(node.content.getOutput()) ?? 
                        node.content.getOutput()
                      )}
                    </div>
                  </div>
                )}
              </NodeRenderer>
            ))}
          </Canvas>
        </div>
      </div>
    </NetworkProvider>
  )
}