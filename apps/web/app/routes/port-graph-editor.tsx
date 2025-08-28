import React, { useRef, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NodeEditor, ClassicPreset } from 'rete'
import { ReactPlugin } from 'rete-react-plugin'
import type { ReactArea2D } from 'rete-react-plugin'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { Presets as ReactPresets } from 'rete-react-plugin'
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin'
import { getDOMSocketPosition } from 'rete-render-utils'
import { GraphRegistry, PortGraph } from 'port-graphs'
import type { GadgetRecord, PortRecord, ConnectionRecord, GraphId, PortId, GadgetId, ConnectionId } from 'port-graphs'
import { CustomPortGraphNode, CustomSocket } from '../components/CustomPortGraphNode'

// Socket for all connections
const portSocket = new ClassicPreset.Socket('port')

// Node class for visualizing gadgets with dimensions for auto-arrange
class GadgetNode extends ClassicPreset.Node {
  gadgetId!: GadgetId
  gadgetType: string = 'function'
  hasLadder: boolean = false
  width = 180
  height = 120
  
  constructor(gadgetId: GadgetId, label: string, type: string = 'function') {
    super(label)
    this.gadgetId = gadgetId
    this.gadgetType = type
  }
  
  // Calculate height based on number of ports
  updateSize() {
    const inputCount = Object.keys(this.inputs).length
    const outputCount = Object.keys(this.outputs).length
    const maxPorts = Math.max(inputCount, outputCount)
    
    // Base height + height per port pair
    this.height = Math.max(120, 60 + (maxPorts * 35))
    
    // Wider for certain types
    if (this.gadgetType === 'aggregator' || this.gadgetType === 'splitter') {
      this.width = 200
    } else if (this.gadgetType === 'function' && (inputCount > 2 || outputCount > 2)) {
      this.width = 200
    }
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
  const arrange = new AutoArrangePlugin<any>()
  
  // Setup plugin chain
  editor.use(area)
  area.use(connection)
  area.use(render)
  area.use(arrange)
  
  // Configure socket position watcher for centered ports
  const socketPositionWatcher = getDOMSocketPosition({
    offset({ x, y }, nodeId, side, key) {
      // Get the node to calculate port positioning
      const node = editor.getNode(nodeId) as GadgetNode | undefined
      if (!node) return { x, y }
      
      // Count ports on this side
      const ports = side === 'input' ? node.inputs : node.outputs
      const portCount = Object.keys(ports).length
      const portKeys = Object.keys(ports)
      const portIndex = portKeys.indexOf(key)
      
      if (portIndex === -1) return { x, y }
      
      // Calculate vertical centering
      const nodeHeight = node.height || 120
      const spacing = nodeHeight / (portCount + 1)
      const yOffset = spacing * (portIndex + 1) - (nodeHeight / 2)
      
      return {
        x: x + (side === 'input' ? -8 : 8), // Move slightly outside node
        y: yOffset
      }
    }
  })
  
  // Add presets for rendering and arranging
  connection.addPreset(ConnectionPresets.classic.setup())
  render.addPreset(ReactPresets.classic.setup({
    customize: {
      node(context) {
        const node = context.payload as GadgetNode
        // Return a component function that renders our custom node
        return (props: any) => {
          const selected = selector.entities.has(node.id)
          return CustomPortGraphNode({
            ...props,
            data: {
              ...props.data,
              gadgetType: node.gadgetType,
              width: node.width,
              height: node.height,
              hasLadder: node.hasLadder,
              selected: selected
            }
          })
        }
      },
      socket() {
        return CustomSocket
      }
    },
    socketPositionWatcher
  }))
  arrange.addPreset(ArrangePresets.classic.setup())
  
  // Apply node styling after rendering
  editor.addPipe(context => {
    if (context.type === 'nodecreated' || context.type === 'noderemoved') {
      // After node creation, apply visual properties
      // Styling handled by custom components
    }
    return context
  })
  
  // Enable node selection with Rete's built-in selection
  const selector = AreaExtensions.selector()
  const accumulating = AreaExtensions.accumulateOnCtrl();
  AreaExtensions.selectableNodes(area, selector, { accumulating });
  
  // Store selector for external access
  (editor as any).selector = selector
  
  // Track selection changes and update visual feedback
  area.addPipe(context => {
    if (context.type === 'nodepicked' || context.type === 'nodeselected' || context.type === 'nodeunselected') {
      // Trigger re-render to update selected state
      setTimeout(() => {
        editor.getNodes().forEach(node => {
          area.update('node', node.id)
        })
      }, 0)
      
      // Store selected nodes
      const selectedNodes = selector.entities;
      (editor as any).selectedNodes = new Set(selectedNodes)
      onGraphChange()
    }
    
    if (context.type === 'nodeunselected') {
      const nodeId = context.data
      const view = area.nodeViews.get(nodeId)
      if (view?.element) {
        view.element.classList.remove('selected')
      }
      onGraphChange()
    }
    
    return context
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
        type: node.gadgetType || 'function',
        ladder: null
      }
      currentGraph.addGadget(gadget as any)
      
      // Add ports based on the node's actual ports
      Object.entries(node.inputs).forEach(([key]) => {
        const inputPort: PortRecord = {
          name: `port-${node.id}-${key}` as PortId,
          recordType: 'port',
          type: 'any',
          direction: 'input',
          position: 'left',
          gadget: node.gadgetId,
          currentValue: null
        }
        currentGraph.addPort(inputPort as any)
      })
      
      Object.entries(node.outputs).forEach(([key]) => {
        const outputPort: PortRecord = {
          name: `port-${node.id}-${key}` as PortId,
          recordType: 'port',
          type: 'any',
          direction: 'output',
          position: 'right',
          gadget: node.gadgetId,
          currentValue: null
        }
        currentGraph.addPort(outputPort as any)
      })
      
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
    
    // First, add interface ports as special nodes if we're inside a ladder
    const interfacePorts = currentGraph.interface
    if (interfacePorts.length > 0) {
      // We're inside a ladder graph - show interface ports
      interfacePorts.forEach((port, index) => {
        const portLabel = port.name.split('-').pop() || port.name
        const interfaceNode = new GadgetNode(
          `interface-${port.name}` as GadgetId,
          `🔌 ${portLabel}`,
          'interface'
        )
        interfaceNode.width = 140
        interfaceNode.height = 80
        
        // Add port based on direction
        if (port.direction === 'input') {
          interfaceNode.addOutput(portLabel, new ClassicPreset.Output(portSocket, portLabel))
        } else {
          interfaceNode.addInput(portLabel, new ClassicPreset.Input(portSocket, portLabel))
        }
        
        // Update size
        interfaceNode.updateSize()
        
        interfaceNode.id = `interface-${index}`
        editor.addNode(interfaceNode)
        
        // Position interface nodes at edges
        const x = port.direction === 'input' ? 50 : 750
        const y = 100 + index * 100
        area.translate(interfaceNode.id, { x, y })
      })
    }
    
    // Create nodes for gadgets
    for (const gadget of currentGraph.gadgetRecords) {
      // Extract a better label from the gadget name
      const labelParts = gadget.name.split('_')
      const label = labelParts.length > 1 ? labelParts.slice(0, -1).join('_') : gadget.name
      
      const node = new GadgetNode(gadget.name, label, gadget.type)
      node.hasLadder = !!gadget.ladder
      
      // Add ports based on port records
      const ports = currentGraph.getGadgetPorts(gadget.name)
      ports.forEach((port, idx) => {
        // Use simpler port keys for Rete
        const portKey = port.name.split('-').pop() || `port${idx}`
        if (port.direction === 'input') {
          node.addInput(portKey, new ClassicPreset.Input(portSocket, portKey))
        } else {
          node.addOutput(portKey, new ClassicPreset.Output(portSocket, portKey))
        }
      })
      
      // Update node size based on ports
      node.updateSize()
      
      // Use numeric ID for Rete
      node.id = gadget.name.replace(/[^0-9]/g, '') || Math.random().toString(36).substring(2, 11)
      await editor.addNode(node)
      
      // Position randomly (could store in gadget attributes)
      await area.translate(node.id, {
        x: Math.random() * 600,
        y: Math.random() * 400
      })
    }
    
    // Apply visual styling after nodes are created
    // Styling handled by custom components
    
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
  (editor as any).rebuildFromGraph = rebuildEditor;
  
  // Store arrange function for external use
  (editor as any).autoArrange = async (algorithm?: string) => {
    await arrange.layout({
      options: {
        'elk.algorithm': algorithm || 'layered',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.direction': 'RIGHT'
      }
    } as any)
  }
  
  // Initial build
  await rebuildEditor()
  
  // Return editor with area and arrange attached
  return Object.assign(editor, { area, arrange })
}

// Template storage interface
interface Template {
  id: string
  name: string
  description?: string
  created: string
  data: Record<GraphId, Record<string, any>>
}

// Main component
export default function PortGraphEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<NodeEditor<Schemes> | null>(null)
  const registryRef = useRef(new GraphRegistry())
  const currentGraphRef = useRef<PortGraph>(null as any)
  const [graphPath, setGraphPath] = useState<string[]>(['main'])
  const [, forceUpdate] = useState({})
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [layoutAlgorithm, setLayoutAlgorithm] = useState('layered')
  const [selectedNodeCount, setSelectedNodeCount] = useState(0)
  const [gadgetType, setGadgetType] = useState('function')
  const [functionInputs, setFunctionInputs] = useState(2)
  const [functionOutputs, setFunctionOutputs] = useState(1)
  
  // Initialize with main graph and load templates
  useEffect(() => {
    if (!currentGraphRef.current) {
      currentGraphRef.current = registryRef.current.newGraph('graph-main' as GraphId)
      forceUpdate({})
    }
    
    // Load templates from localStorage
    const savedTemplates = localStorage.getItem('port-graph-templates')
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates))
      } catch (e) {
        console.error('Failed to load templates:', e)
      }
    }
  }, [])
  
  // Create editor
  useEffect(() => {
    if (containerRef.current && currentGraphRef.current && !editor) {
      createPortGraphEditor(
        registryRef.current,
        currentGraphRef,
        () => {
          // Update selected node count when graph changes
          const selector = (editor as any)?.selector
          setSelectedNodeCount(selector?.entities?.length || 0)
          forceUpdate({})
        }
      )(containerRef.current).then(setEditor)
    }
  }, [currentGraphRef.current])
  
  // Poll for selection changes (since Rete doesn't always fire events)
  useEffect(() => {
    if (!editor) return
    
    const interval = setInterval(() => {
      const selector = (editor as any)?.selector
      const count = selector?.entities?.length || 0
      if (count !== selectedNodeCount) {
        setSelectedNodeCount(count)
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [editor, selectedNodeCount])
  
  // Auto-arrange nodes
  const autoArrange = async () => {
    if (!editor || !(editor as any).autoArrange) return
    await (editor as any).autoArrange(layoutAlgorithm)
  }
  
  // Bulk connect selected nodes
  const bulkConnect = async () => {
    if (!editor) return
    
    // Get selected nodes from Rete's selector
    const selector = (editor as any).selector
    if (!selector || selector.entities.length < 2) {
      alert('Select at least 2 nodes to bulk connect')
      return
    }
    
    const selected = [...selector.entities]
    let connectionsAdded = 0
    
    // Connect nodes in selection order
    for (let i = 0; i < selected.length - 1; i++) {
      const sourceNode = editor.getNode(selected[i]) as GadgetNode | undefined
      const targetNode = editor.getNode(selected[i + 1]) as GadgetNode | undefined
      
      if (!sourceNode || !targetNode) continue
      
      const sourceOutputs = Object.keys(sourceNode.outputs)
      const targetInputs = Object.keys(targetNode.inputs)
      
      if (sourceOutputs.length > 0 && targetInputs.length > 0) {
        // Check if connection already exists
        const existingConnections = editor.getConnections()
        const connectionExists = existingConnections.some(c => 
          c.source === sourceNode.id && 
          c.target === targetNode.id &&
          c.sourceOutput === sourceOutputs[0] &&
          c.targetInput === targetInputs[0]
        )
        
        if (!connectionExists) {
          const connection = new GadgetConnection(
            sourceNode,
            sourceOutputs[0] || 'out',
            targetNode,
            targetInputs[0] || 'in'
          )
          await editor.addConnection(connection)
          connectionsAdded++
        }
      }
    }
    
    if (connectionsAdded > 0) {
      alert(`Added ${connectionsAdded} connection(s)`)
    } else {
      alert('No new connections could be made')
    }
  }
  
  // Add new gadget with dynamic ports based on type
  const addGadget = async () => {
    if (!editor) return
    
    const timestamp = Date.now().toString().slice(-6)
    const id = `gadget-${Date.now()}` as GadgetId
    
    // Create meaningful labels based on type
    let label = ''
    switch (gadgetType) {
      case 'cell':
        label = `Cell_${timestamp}`
        break
      case 'function':
        label = `Fn(${functionInputs}→${functionOutputs})_${timestamp}`
        break
      case 'aggregator':
        label = `Aggregate_${timestamp}`
        break
      case 'splitter':
        label = `Split_${timestamp}`
        break
      case 'passthrough':
        label = `Pass_${timestamp}`
        break
      default:
        label = `${gadgetType}_${timestamp}`
    }
    
    const node = new GadgetNode(id, label, gadgetType)
    
    // Add ports based on gadget type
    switch (gadgetType) {
      case 'cell':
        // Cells have multiple inputs, one output
        node.addInput('in1', new ClassicPreset.Input(portSocket, 'In 1'))
        node.addInput('in2', new ClassicPreset.Input(portSocket, 'In 2'))
        node.addOutput('out', new ClassicPreset.Output(portSocket, 'Output'))
        break
        
      case 'function':
        // Functions have configurable inputs/outputs
        for (let i = 0; i < functionInputs; i++) {
          const portName = String.fromCharCode(97 + i) // a, b, c...
          node.addInput(portName, new ClassicPreset.Input(portSocket, portName.toUpperCase()))
        }
        for (let i = 0; i < functionOutputs; i++) {
          const portName = functionOutputs === 1 ? 'result' : `out${i + 1}`
          node.addOutput(portName, new ClassicPreset.Output(portSocket, portName))
        }
        break
        
      case 'aggregator':
        // Aggregators have many inputs, one output
        for (let i = 1; i <= 4; i++) {
          node.addInput(`in${i}`, new ClassicPreset.Input(portSocket, `In ${i}`))
        }
        node.addOutput('aggregate', new ClassicPreset.Output(portSocket, 'Aggregate'))
        break
        
      case 'splitter':
        // Splitters have one input, many outputs
        node.addInput('input', new ClassicPreset.Input(portSocket, 'Input'))
        for (let i = 1; i <= 3; i++) {
          node.addOutput(`out${i}`, new ClassicPreset.Output(portSocket, `Out ${i}`))
        }
        break
        
      case 'passthrough':
        // Pass-through has bidirectional ports
        node.addInput('in', new ClassicPreset.Input(portSocket, 'In'))
        node.addOutput('out', new ClassicPreset.Output(portSocket, 'Out'))
        break
        
      default:
        // Default: simple input/output
        node.addInput('in', new ClassicPreset.Input(portSocket, 'Input'))
        node.addOutput('out', new ClassicPreset.Output(portSocket, 'Output'))
    }
    
    // Update node size based on ports
    node.updateSize()
    
    await editor.addNode(node)
    
    // Position in center-ish
    const area = (editor as any).area
    await area.translate(node.id, { x: 300, y: 200 })
    
    // Apply visual styling
    // Styling handled by custom components
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
  
  // Save templates to localStorage
  const saveTemplatesToStorage = (newTemplates: Template[]) => {
    localStorage.setItem('port-graph-templates', JSON.stringify(newTemplates))
    setTemplates(newTemplates)
  }
  
  // Save current graph as template
  const saveAsTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name')
      return
    }
    
    const template: Template = {
      id: `template-${Date.now()}`,
      name: templateName,
      description: templateDescription,
      created: new Date().toISOString(),
      data: currentGraphRef.current.flatten()
    }
    
    const newTemplates = [...templates, template]
    saveTemplatesToStorage(newTemplates)
    
    // Reset dialog
    setShowTemplateDialog(false)
    setTemplateName('')
    setTemplateDescription('')
  }
  
  // Load template
  const loadTemplate = async (template: Template) => {
    if (!confirm(`Load template "${template.name}"? This will replace the current graph.`)) {
      return
    }
    
    // Clear registry and recreate graphs
    registryRef.current = new GraphRegistry()
    
    for (const [graphId, records] of Object.entries(template.data)) {
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
  
  // Delete template
  const deleteTemplate = (templateId: string) => {
    if (!confirm('Delete this template?')) return
    
    const newTemplates = templates.filter(t => t.id !== templateId)
    saveTemplatesToStorage(newTemplates)
  }
  
  // Export template to file
  const exportTemplate = (template: Template) => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Export all templates
  const exportAllTemplates = () => {
    if (templates.length === 0) {
      alert('No templates to export')
      return
    }
    
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'port-graph-templates.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Import templates from file
  const importTemplates = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      
      // Check if it's a single template or array of templates
      const imported = Array.isArray(data) ? data : [data]
      
      // Validate templates
      const validTemplates = imported.filter(t => 
        t.id && t.name && t.data && typeof t.data === 'object'
      )
      
      if (validTemplates.length === 0) {
        alert('No valid templates found in file')
        return
      }
      
      // Merge with existing templates (avoid duplicates by ID)
      const existingIds = new Set(templates.map(t => t.id))
      const newTemplates = [...templates]
      
      validTemplates.forEach(template => {
        if (!existingIds.has(template.id)) {
          newTemplates.push(template)
        } else {
          // Generate new ID for duplicate
          newTemplates.push({
            ...template,
            id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: `${template.name} (imported)`,
            created: new Date().toISOString()
          })
        }
      })
      
      saveTemplatesToStorage(newTemplates)
      alert(`Imported ${validTemplates.length} template(s)`)
    } catch (e) {
      console.error('Failed to import templates:', e)
      alert('Failed to import templates. Please check the file format.')
    }
    
    // Reset file input
    event.target.value = ''
  }
  
  // Assign ladder to selected gadget
  const assignLadder = async () => {
    if (!editor) return
    
    const selector = (editor as any).selector
    if (!selector || selector.entities.length !== 1) {
      alert('Select exactly one node to assign a ladder')
      return
    }
    
    const selectedNodeId = selector.entities[0]
    const selectedNodes = [editor.getNode(selectedNodeId)].filter(Boolean)
    if (selectedNodes.length !== 1) {
      alert('Select exactly one node to assign a ladder')
      return
    }
    
    const node = selectedNodes[0] as GadgetNode
    const gadget = currentGraphRef.current.records[node.gadgetId] as GadgetRecord
    
    // Create new ladder graph
    const ladderId = `graph-ladder-${Date.now()}` as GraphId
    const ladderGraph = registryRef.current.newGraph(ladderId)
    
    // Create free ports matching gadget's actual visual ports
    Object.entries(node.inputs).forEach(([key]) => {
      const freePort: PortRecord = {
        name: `port-interface-${key}` as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'input',
        position: 'left',
        gadget: null, // Free port
        currentValue: null
      }
      ladderGraph.addPort(freePort as any)
    })
    
    Object.entries(node.outputs).forEach(([key]) => {
      const freePort: PortRecord = {
        name: `port-interface-${key}` as PortId,
        recordType: 'port',
        type: 'any',
        direction: 'output',
        position: 'right',
        gadget: null, // Free port
        currentValue: null
      }
      ladderGraph.addPort(freePort as any)
    })
    
    // Update gadget to reference ladder
    gadget.ladder = ladderId
    node.hasLadder = true
    
    forceUpdate({})
  }
  
  return (
    <>
      <style>{`
        /* Basic selection styling */
        .selected {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
        }
      `}</style>
      <div className="flex h-screen bg-gray-50">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1" />
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-l border-gray-200 p-4 space-y-4 overflow-y-auto">
        <h2 className="text-lg font-bold">Port-Graph Editor</h2>
        
        {/* Breadcrumb navigation */}
        <div className="border rounded p-2 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="text-sm text-gray-600 mb-1">Navigation:</div>
          <div className="flex items-center gap-1 flex-wrap">
            {graphPath.map((segment, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-400 text-xs">›</span>}
                <span className="font-medium text-sm bg-white px-2 py-1 rounded shadow-sm">
                  {segment}
                </span>
              </React.Fragment>
            ))}
          </div>
          {graphPath.length > 1 && (
            <button
              onClick={navigateUp}
              className="mt-2 w-full text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <span>↑</span> Back to Parent Graph
            </button>
          )}
          {currentGraphRef.current?.interface.length > 0 && (
            <div className="mt-2 text-xs text-purple-600">
              ℹ️ This is a ladder graph with {currentGraphRef.current.interface.length} interface port(s)
            </div>
          )}
        </div>
        
        {/* Graph info */}
        <div className="text-sm text-gray-600">
          <div>Gadgets: {currentGraphRef.current?.gadgetRecords.length || 0}</div>
          <div>Connections: {currentGraphRef.current?.connectionRecords.length || 0}</div>
          <div>Free Ports: {currentGraphRef.current?.interface.length || 0}</div>
        </div>
        
        {/* Gadget Creation */}
        <div className="border rounded p-2 space-y-2 mb-4">
          <label className="block text-sm font-medium">Create Gadget</label>
          <select
            value={gadgetType}
            onChange={(e) => setGadgetType(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option value="cell">Cell (merge)</option>
            <option value="function">Function</option>
            <option value="aggregator">Aggregator</option>
            <option value="splitter">Splitter</option>
            <option value="passthrough">Pass-through</option>
          </select>
          
          {gadgetType === 'function' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs">Inputs ({functionInputs})</label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={functionInputs}
                  onChange={(e) => setFunctionInputs(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs">Outputs ({functionOutputs})</label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={functionOutputs}
                  onChange={(e) => setFunctionOutputs(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
          
          <button
            onClick={addGadget}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add {gadgetType}
          </button>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          
          <button
            onClick={assignLadder}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Assign Ladder to Selected
          </button>
          
          {/* Auto-arrange controls */}
          <div className="border rounded p-2 space-y-2">
            <label className="block text-sm font-medium">Auto Layout</label>
            <select
              value={layoutAlgorithm}
              onChange={(e) => setLayoutAlgorithm(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="layered">Layered (Hierarchical)</option>
              <option value="force">Force Directed</option>
              <option value="stress">Stress Minimization</option>
              <option value="mrtree">Tree</option>
              <option value="radial">Radial</option>
            </select>
            <button
              onClick={autoArrange}
              className="w-full px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Auto Arrange
            </button>
          </div>
          
          {/* Bulk Operations */}
          <div className="border rounded p-2 space-y-2">
            <label className="block text-sm font-medium">
              Bulk Operations {selectedNodeCount > 0 && `(${selectedNodeCount} selected)`}
            </label>
            <button
              onClick={bulkConnect}
              className="w-full px-3 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:bg-gray-300"
              disabled={selectedNodeCount < 2}
            >
              Connect Selected
            </button>
            <div className="text-xs text-gray-500">
              Ctrl/Cmd+Click to select multiple nodes
            </div>
          </div>
          
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
        
        {/* Template Management */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Templates</h3>
          <button
            onClick={() => setShowTemplateDialog(true)}
            className="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 mb-2"
          >
            Save as Template
          </button>
          
          {/* Template Actions */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={exportAllTemplates}
              className="flex-1 text-sm px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              disabled={templates.length === 0}
            >
              Export All
            </button>
            <label className="flex-1 text-sm px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-center cursor-pointer">
              Import
              <input
                type="file"
                accept=".json"
                onChange={importTemplates}
                className="hidden"
              />
            </label>
          </div>
          
          {/* Template List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-sm text-gray-500">No templates saved</p>
            ) : (
              templates.map(template => (
                <div
                  key={template.id}
                  className="border rounded p-2 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{template.name}</div>
                      {template.description && (
                        <div className="text-xs text-gray-500">{template.description}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(template.created).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => loadTemplate(template)}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="Load template"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => exportTemplate(template)}
                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        title="Export template"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        title="Delete template"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-start gap-1">
            <span className="text-purple-500">⬇</span>
            <span>Double-click gadget with ladder to drill in</span>
          </p>
          <p className="flex items-start gap-1">
            <span className="text-blue-500">⌘</span>
            <span>Ctrl/Cmd+click to multi-select</span>
          </p>
          <p className="flex items-start gap-1">
            <span className="text-green-500">📦</span>
            <span>Export flattens all referenced graphs</span>
          </p>
          <p className="flex items-start gap-1">
            <span className="text-purple-500">🔌</span>
            <span>Purple nodes are interface ports</span>
          </p>
        </div>
      </div>
      
      {/* Template Save Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Save as Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Template"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe what this template does..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowTemplateDialog(false)
                  setTemplateName('')
                  setTemplateDescription('')
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAsTemplate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}