import React, { useRef, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NodeEditor, ClassicPreset } from 'rete'
import { ReactPlugin } from 'rete-react-plugin'
import type { ReactArea2D } from 'rete-react-plugin'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { Presets as ReactPresets } from 'rete-react-plugin'
import { GraphRegistry, PortGraph } from 'port-graphs'
import type { GadgetRecord, PortRecord, ConnectionRecord, GraphId, PortId, GadgetId, ConnectionId } from 'port-graphs'

// Socket for all connections
const portSocket = new ClassicPreset.Socket('port')

// Node class for visualizing gadgets
class GadgetNode extends ClassicPreset.Node {
  gadgetId!: GadgetId
  hasLadder: boolean = false
  
  constructor(gadgetId: GadgetId, label: string) {
    super(label)
    this.gadgetId = gadgetId
  }
}

// Define connection type
class GadgetConnection extends ClassicPreset.Connection<GadgetNode, GadgetNode> {}

// Simple schemes type
type Schemes = {
  Node: GadgetNode
  Connection: GadgetConnection
}

// Create editor with port-graph synchronization
const createPortGraphEditor = (
  registry: GraphRegistry,
  currentGraphRef: React.RefObject<PortGraph> & { current: PortGraph },
  onGraphChange: () => void
) => async (container: HTMLElement) => {
  const editor = new NodeEditor<Schemes>()
  const area = new AreaPlugin<any, any>(container)
  const connection = new ConnectionPlugin<any, any>()
  const render = new ReactPlugin<any, any>({ createRoot })
  
  // Setup plugin chain
  editor.use(area)
  area.use(connection)
  area.use(render)
  
  // Add presets for rendering
  connection.addPreset(ConnectionPresets.classic.setup())
  render.addPreset(ReactPresets.classic.setup())
  
  // Enable node selection
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl()
  })
  
  // Sync: Rete node creation → Port-graph gadget
  editor.addPipe(context => {
    if (context.type === 'nodecreated') {
      const node = context.data
      const currentGraph = currentGraphRef.current
      
      // Add gadget record
      const gadget: GadgetRecord = {
        name: node.gadgetId,
        recordType: 'gadget',
        type: 'function',
        ladder: null
      }
      currentGraph.addGadget(gadget as any)
      
      // Add default input and output ports
      const inputPort: PortRecord = {
        name: `port-${node.id}-in` as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'input',
        position: 'left',
        gadget: node.gadgetId,
        currentValue: null
      }
      const outputPort: PortRecord = {
        name: `port-${node.id}-out` as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'output',
        position: 'right',
        gadget: node.gadgetId,
        currentValue: null
      }
      currentGraph.addPort(inputPort as any)
      currentGraph.addPort(outputPort as any)
      
      onGraphChange()
    }
    
    if (context.type === 'noderemoved') {
      const node = context.data
      const currentGraph = currentGraphRef.current
      
      // Remove gadget and its ports
      const ports = currentGraph.getGadgetPorts(node.gadgetId)
      ports.forEach(port => {
        delete currentGraph.records[port.name]
      })
      delete currentGraph.records[node.gadgetId]
      
      onGraphChange()
    }
    
    return context
  })
  
  // Handle connection events after they're created
  editor.addPipe(context => {
    if (context.type === 'connectioncreated') {
      const conn = context.data
      const currentGraph = currentGraphRef.current
      
      // Map Rete connection to port IDs
      const sourcePortId = `port-${conn.source}-out` as PortId
      const targetPortId = `port-${conn.target}-in` as PortId
      
      const edge: ConnectionRecord = {
        name: `conn-${conn.id}` as ConnectionId,
        recordType: 'connection',
        source: sourcePortId,
        target: targetPortId
      }
      currentGraph.addEdge(edge as any)
      
      onGraphChange()
    }
    
    if (context.type === 'connectionremoved') {
      const conn = context.data
      const currentGraph = currentGraphRef.current
      
      // Find and remove the connection record
      const connName = `conn-${conn.id}` as ConnectionId
      delete currentGraph.records[connName]
      
      onGraphChange()
    }
    
    return context
  })
  
  // Handle double-click for ladder navigation
  area.addPipe(context => {
    if (context.type === 'nodepicked') {
      const event = (context.data as any).event
      if (event?.detail === 2) { // Double-click
        const nodeId = context.data.id
        const node = editor.getNode(nodeId) as GadgetNode
        if (node) {
          const currentGraph = currentGraphRef.current
          const gadget = currentGraph.records[node.gadgetId] as GadgetRecord
          
          if (gadget?.ladder) {
            // Drill into ladder graph
            const ladderGraph = registry.getGraph(gadget.ladder)
            currentGraphRef.current = ladderGraph
            onGraphChange()
            
            // Rebuild editor with new graph
            rebuildEditor()
          }
        }
      }
    }
    return context
  })
  
  // Function to rebuild editor from current graph
  const rebuildEditor = async () => {
    await editor.clear()
    const currentGraph = currentGraphRef.current
    
    // Create nodes for gadgets
    for (const gadget of currentGraph.gadgetRecords) {
      const node = new GadgetNode(gadget.name, gadget.name)
      node.hasLadder = !!gadget.ladder
      
      // Add ports based on port records
      const ports = currentGraph.getGadgetPorts(gadget.name)
      ports.forEach(port => {
        if (port.direction === 'input') {
          node.addInput(port.name, new ClassicPreset.Input(portSocket, port.name))
        } else {
          node.addOutput(port.name, new ClassicPreset.Output(portSocket, port.name))
        }
      })
      
      // Use numeric ID for Rete
      node.id = gadget.name.replace(/[^0-9]/g, '') || Math.random().toString(36).substring(2, 11)
      await editor.addNode(node)
      
      // Position randomly (could store in gadget attributes)
      await area.translate(node.id, {
        x: Math.random() * 600,
        y: Math.random() * 400
      })
    }
    
    // Create connections
    for (const conn of currentGraph.connectionRecords) {
      // Find nodes that own these ports
      const sourcePort = currentGraph.records[conn.source] as PortRecord
      const targetPort = currentGraph.records[conn.target] as PortRecord
      
      if (sourcePort?.gadget && targetPort?.gadget) {
        const sourceNode = Array.from(editor.getNodes()).find(n => 
          (n as GadgetNode).gadgetId === sourcePort.gadget
        )
        const targetNode = Array.from(editor.getNodes()).find(n => 
          (n as GadgetNode).gadgetId === targetPort.gadget
        )
        
        if (sourceNode && targetNode) {
          const connection = new GadgetConnection(
            sourceNode as GadgetNode,
            conn.source,
            targetNode as GadgetNode,
            conn.target
          )
          await editor.addConnection(connection)
        }
      }
    }
    
    // Auto-zoom to fit
    await AreaExtensions.zoomAt(area, editor.getNodes())
  }
  
  // Store rebuild function for external use
  (editor as any).rebuildFromGraph = rebuildEditor
  
  // Initial build
  await rebuildEditor()
  
  // Return editor with area attached
  return Object.assign(editor, { area })
}

// Main component
export default function PortGraphEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<NodeEditor<Schemes> | null>(null)
  const registryRef = useRef(new GraphRegistry())
  const currentGraphRef = useRef<PortGraph>(null as any)
  const [graphPath, setGraphPath] = useState<string[]>(['main'])
  const [, forceUpdate] = useState({})
  
  // Initialize with main graph
  useEffect(() => {
    if (!currentGraphRef.current) {
      currentGraphRef.current = registryRef.current.newGraph('graph-main' as GraphId)
      forceUpdate({})
    }
  }, [])
  
  // Create editor
  useEffect(() => {
    if (containerRef.current && currentGraphRef.current && !editor) {
      createPortGraphEditor(
        registryRef.current,
        currentGraphRef,
        () => forceUpdate({})
      )(containerRef.current).then(setEditor)
    }
  }, [currentGraphRef.current])
  
  // Add new gadget
  const addGadget = async () => {
    if (!editor) return
    
    const id = `gadget-${Date.now()}` as GadgetId
    const node = new GadgetNode(id, id)
    
    // Add default ports
    node.addInput('in', new ClassicPreset.Input(portSocket, 'Input'))
    node.addOutput('out', new ClassicPreset.Output(portSocket, 'Output'))
    
    await editor.addNode(node)
    
    // Position in center-ish
    const area = (editor as any).area
    await area.translate(node.id, { x: 300, y: 200 })
  }
  
  // Export flattened graphs
  const exportGraphs = () => {
    const flattened = currentGraphRef.current.flatten()
    const blob = new Blob([JSON.stringify(flattened, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'port-graphs.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Import graphs
  const importGraphs = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const text = await file.text()
    const data = JSON.parse(text) as Record<GraphId, Record<string, any>>
    
    // Clear registry and recreate graphs
    registryRef.current = new GraphRegistry()
    
    for (const [graphId, records] of Object.entries(data)) {
      const graph = registryRef.current.newGraph(graphId as GraphId)
      Object.assign(graph.records, records)
    }
    
    // Load main graph
    currentGraphRef.current = registryRef.current.getGraph('graph-main' as GraphId)
    setGraphPath(['main'])
    
    // Rebuild editor
    if (editor && (editor as any).rebuildFromGraph) {
      await (editor as any).rebuildFromGraph()
    }
    
    forceUpdate({})
  }
  
  // Navigate to parent graph
  const navigateUp = async () => {
    if (graphPath.length <= 1) return
    
    const newPath = graphPath.slice(0, -1)
    const parentId = `graph-${newPath[newPath.length - 1]}` as GraphId
    currentGraphRef.current = registryRef.current.getGraph(parentId)
    setGraphPath(newPath)
    
    if (editor && (editor as any).rebuildFromGraph) {
      await (editor as any).rebuildFromGraph()
    }
    
    forceUpdate({})
  }
  
  // Assign ladder to selected gadget
  const assignLadder = async () => {
    if (!editor) return
    
    const selectedNodes = editor.getNodes().filter(n => (n as any).selected)
    if (selectedNodes.length !== 1) {
      alert('Select exactly one node to assign a ladder')
      return
    }
    
    const node = selectedNodes[0] as GadgetNode
    const gadget = currentGraphRef.current.records[node.gadgetId] as GadgetRecord
    
    // Create new ladder graph
    const ladderId = `graph-ladder-${Date.now()}` as GraphId
    const ladderGraph = registryRef.current.newGraph(ladderId)
    
    // Create free ports matching gadget's ports
    const ports = currentGraphRef.current.getGadgetPorts(node.gadgetId)
    ports.forEach(port => {
      const freePort: PortRecord = {
        ...port,
        gadget: null // Free port
      }
      ladderGraph.addPort(freePort as any)
    })
    
    // Update gadget to reference ladder
    gadget.ladder = ladderId
    node.hasLadder = true
    
    forceUpdate({})
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1" />
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-l border-gray-200 p-4 space-y-4">
        <h2 className="text-lg font-bold">Port-Graph Editor</h2>
        
        {/* Breadcrumb navigation */}
        <div className="border rounded p-2">
          <div className="text-sm text-gray-600 mb-1">Current Graph:</div>
          <div className="flex items-center gap-2">
            {graphPath.map((segment, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-400">›</span>}
                <span className="font-medium">{segment}</span>
              </React.Fragment>
            ))}
          </div>
          {graphPath.length > 1 && (
            <button
              onClick={navigateUp}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              ← Back to parent
            </button>
          )}
        </div>
        
        {/* Graph info */}
        <div className="text-sm text-gray-600">
          <div>Gadgets: {currentGraphRef.current?.gadgetRecords.length || 0}</div>
          <div>Connections: {currentGraphRef.current?.connectionRecords.length || 0}</div>
          <div>Free Ports: {currentGraphRef.current?.interface.length || 0}</div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={addGadget}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Gadget
          </button>
          
          <button
            onClick={assignLadder}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Assign Ladder to Selected
          </button>
          
          <button
            onClick={exportGraphs}
            className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export Graphs
          </button>
          
          <label className="block w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-center cursor-pointer">
            Import Graphs
            <input
              type="file"
              accept=".json"
              onChange={importGraphs}
              className="hidden"
            />
          </label>
        </div>
        
        <div className="text-xs text-gray-500">
          <p>• Double-click gadget with ladder to drill in</p>
          <p>• Ctrl+click to multi-select</p>
          <p>• Export flattens all referenced graphs</p>
        </div>
      </div>
    </div>
  )
}