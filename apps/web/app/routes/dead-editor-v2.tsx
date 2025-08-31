import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { NodeEditor, ClassicPreset } from 'rete'
import type { GetSchemes } from 'rete'
import { ReactPlugin } from 'rete-react-plugin'
import type { ReactArea2D } from 'rete-react-plugin'
import { AreaPlugin, AreaExtensions, Zoom } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { Presets as ReactPresets } from 'rete-react-plugin'

// Socket for connections
const socket = new ClassicPreset.Socket('value')

// Types
type Schemes = GetSchemes<
  DeadCellNode | DeadPropagatorNode | DeadMacroNode,
  ClassicPreset.Connection<DeadCellNode | DeadPropagatorNode | DeadMacroNode, DeadCellNode | DeadPropagatorNode | DeadMacroNode>
>

// Node classes
class DeadCellNode extends ClassicPreset.Node {
  prefix: string = 'main'
  mergeFunction: string = 'last'
  width = 180
  height = 120
  hidden = false
  
  constructor(label: string) {
    super(label)
    this.prefix = 'main'
    
    // Cells can have multiple inputs, single output
    this.addInput('in1', new ClassicPreset.Input(socket, 'In 1', true))
    this.addInput('in2', new ClassicPreset.Input(socket, 'In 2', true))
    this.addOutput('out', new ClassicPreset.Output(socket, 'Output'))
  }
}

class DeadPropagatorNode extends ClassicPreset.Node {
  prefix: string = 'main'
  functionType: string = 'identity'
  width = 200
  height = 120
  hidden = false
  
  constructor(label: string, fnType: string = 'identity') {
    super(label)
    this.prefix = 'main'
    this.functionType = fnType
    
    // Configure inputs/outputs based on function type
    switch(fnType) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
        this.addInput('a', new ClassicPreset.Input(socket, 'A'))
        this.addInput('b', new ClassicPreset.Input(socket, 'B'))
        this.addOutput('result', new ClassicPreset.Output(socket, 'Result'))
        break
        
      case 'clamp':
        this.addInput('value', new ClassicPreset.Input(socket, 'Value'))
        this.addInput('min', new ClassicPreset.Input(socket, 'Min'))
        this.addInput('max', new ClassicPreset.Input(socket, 'Max'))
        this.addOutput('result', new ClassicPreset.Output(socket, 'Result'))
        break
        
      case 'compare':
        this.addInput('a', new ClassicPreset.Input(socket, 'A'))
        this.addInput('b', new ClassicPreset.Input(socket, 'B'))
        this.addOutput('equal', new ClassicPreset.Output(socket, 'Equal'))
        this.addOutput('greater', new ClassicPreset.Output(socket, 'Greater'))
        this.addOutput('less', new ClassicPreset.Output(socket, 'Less'))
        break
        
      case 'identity':
      default:
        this.addInput('in', new ClassicPreset.Input(socket, 'Input'))
        this.addOutput('out', new ClassicPreset.Output(socket, 'Output'))
        break
    }
  }
}

// TODO: MacroNode for later
class DeadMacroNode extends ClassicPreset.Node {
  prefix: string = 'main'
  expanded: boolean = false
  template: {
    nodes: Array<{
      id: string
      type: 'cell' | 'propagator' | 'macro'
      label: string
      prefix: string
      data: any
    }>
    connections: Array<{
      source: string
      target: string
      sourceOutput: string
      targetInput: string
    }>
  } | null = null
  
  constructor(label: string, template?: typeof DeadMacroNode.prototype.template) {
    super(label)
    this.prefix = 'main'
    const socket = new ClassicPreset.Socket('default')
    
    if (template) {
      this.template = template
      // Create inputs/outputs based on template boundary nodes
      const boundaryInputs = new Map<string, string>()
      const boundaryOutputs = new Map<string, string>()
      
      // Find connections that cross the template boundary
      template.connections.forEach(conn => {
        const sourceInTemplate = template.nodes.some(n => n.id === conn.source)
        const targetInTemplate = template.nodes.some(n => n.id === conn.target)
        
        if (!sourceInTemplate && targetInTemplate) {
          // External source -> template target = input
          boundaryInputs.set(conn.targetInput, conn.targetInput)
        }
        if (sourceInTemplate && !targetInTemplate) {
          // Template source -> external target = output
          boundaryOutputs.set(conn.sourceOutput, conn.sourceOutput)
        }
      })
      
      // Add inputs for boundary inputs
      let inputIndex = 0
      boundaryInputs.forEach((label, key) => {
        this.addInput(`in${inputIndex++}`, new ClassicPreset.Input(socket, label))
      })
      
      // Add outputs for boundary outputs
      let outputIndex = 0
      boundaryOutputs.forEach((label, key) => {
        this.addOutput(`out${outputIndex++}`, new ClassicPreset.Output(socket, label))
      })
    } else {
      // Default macro structure
      this.addInput('in', new ClassicPreset.Input(socket, 'Input'))
      this.addOutput('out', new ClassicPreset.Output(socket, 'Output'))
    }
  }
  
  expand() {
    this.expanded = true
    // When expanded, the macro's template nodes are shown
    return this.template
  }
  
  collapse() {
    this.expanded = false
    // When collapsed, only the macro node is shown
  }
}

type Node = DeadCellNode | DeadPropagatorNode | DeadMacroNode

// Export format
interface DeadNetworkExport {
  cells: Array<{
    id: string
    merge: string
    inputs: string[]
    outputs: string[]
  }>
  propagators: Array<{
    id: string
    fn: string
    inputs: string[]
    outputs: string[]
  }>
  connections: Array<{
    source: string       // Node ID
    sourceOutput: string // Output port name
    target: string       // Node ID
    targetInput: string  // Input port name
  }>
  metadata?: {
    created: string
    version: string
    prefixes?: string[]
  }
}

// Create editor factory  
const createDeadEditor = (
  selectedNodesRef: React.MutableRefObject<Set<string>>,
  setSelectedCount: (count: number) => void
) => async (container: HTMLElement) => {
  const editor = new NodeEditor<Schemes>()
  const area = new AreaPlugin<Schemes, ReactArea2D<Schemes>>(container)
  const connection = new ConnectionPlugin<Schemes, ReactArea2D<Schemes>>()
  const render = new ReactPlugin<Schemes, ReactArea2D<Schemes>>({ createRoot })
  
  // Track current zoom level
  let currentZoom = 1
  let updateGroups: (() => void) | null = null
  
  editor.use(area)
  area.use(connection)
  area.use(render)
  
  // Track selected nodes
  const selectedNodes = selectedNodesRef.current
  
  // Configure zoom to be less sensitive
  area.area.setZoomHandler(new Zoom(0.05)) // Reduced zoom factor for less sensitivity
  
  // Handle keyboard shortcuts
  container.addEventListener('keydown', async (e) => {
    // Delete selected nodes
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const nodeId of selectedNodes) {
        const node = editor.getNode(nodeId)
        if (node) {
          // Remove connections first
          const connections = editor.getConnections().filter(
            c => c.source === nodeId || c.target === nodeId
          )
          for (const conn of connections) {
            await editor.removeConnection(conn.id)
          }
          // Remove node
          await editor.removeNode(nodeId)
          selectedNodes.delete(nodeId)
        }
      }
      setSelectedCount(selectedNodes.size)
    }
    
    // Select all with Ctrl/Cmd+A
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      selectedNodes.clear()
      const allNodes = editor.getNodes()
      allNodes.forEach(node => {
        selectedNodes.add(node.id)
        const view = area.nodeViews.get(node.id)
        if (view?.element) {
          view.element.classList.add('selected')
        }
      })
      setSelectedCount(selectedNodes.size)
    }
    
    // Deselect all with Escape
    if (e.key === 'Escape') {
      selectedNodes.clear()
      setSelectedCount(0)
      editor.getNodes().forEach(node => {
        const view = area.nodeViews.get(node.id)
        if (view?.element) {
          view.element.classList.remove('selected')
        }
      })
    }
  })
  
  // Handle node selection and double-click
  area.addPipe((context) => {
    if (context.type === 'nodepicked') {
      const nodeId = context.data.id
      const event = (context.data as any).event
      const isMultiSelect = event?.ctrlKey || event?.metaKey || event?.shiftKey
      
      // Handle double-click on macro nodes
      if (event?.detail === 2) { // Double click
        const node = editor.getNode(nodeId)
        if (node instanceof DeadMacroNode) {
          if (!node.expanded && node.template) {
            // Expand macro: add template nodes to editor
            const expandedNodes = new Map<string, string>() // old id -> new id
            
            // Add template nodes
            const addNodes = async () => {
              for (const templateNode of node.template!.nodes) {
              const newId = `${nodeId}_${templateNode.id}`
              let newNode: DeadCellNode | DeadPropagatorNode | DeadMacroNode
              
              if (templateNode.type === 'cell') {
                newNode = new DeadCellNode(templateNode.label)
                ;(newNode as DeadCellNode).mergeFunction = templateNode.data?.mergeFunction || 'last'
              } else if (templateNode.type === 'propagator') {
                newNode = new DeadPropagatorNode(templateNode.label, templateNode.data?.functionType || 'identity')
              } else {
                newNode = new DeadMacroNode(templateNode.label, templateNode.data?.template)
              }
              
              newNode.id = newId
              newNode.prefix = templateNode.prefix
              expandedNodes.set(templateNode.id, newId)
              
              await editor.addNode(newNode)
              
              // Position nodes relative to macro position
              const macroPos = await area.nodeViews.get(nodeId)?.position
              if (macroPos) {
                const offsetX = (Math.random() - 0.5) * 400
                const offsetY = (Math.random() - 0.5) * 300
                await area.translate(newId, {
                  x: macroPos.x + offsetX,
                  y: macroPos.y + offsetY + 100
                })
              }
              }
            }
            
            addNodes()
            
            // Add template connections with updated IDs
            setTimeout(async () => {
              if (!node.template) return
              for (const conn of node.template.connections) {
                const newSource = expandedNodes.get(conn.source) || conn.source
                const newTarget = expandedNodes.get(conn.target) || conn.target
                
                // Only create connection if both nodes exist
                const sourceNode = editor.getNode(newSource)
                const targetNode = editor.getNode(newTarget)
                
                if (sourceNode && targetNode) {
                  const connection = new ClassicPreset.Connection(
                    sourceNode,
                    conn.sourceOutput,
                    targetNode,
                    conn.targetInput
                  )
                  await editor.addConnection(connection)
                }
              }
            }, 100)
            
            node.expanded = true
            // Store expanded node IDs for later collapse
            ;(node as any).expandedNodeIds = Array.from(expandedNodes.values())
          } else if (node.expanded && (node as any).expandedNodeIds) {
            // Collapse macro: remove expanded nodes
            const expandedIds = (node as any).expandedNodeIds as string[]
            
            const collapseNodes = async () => {
              for (const expandedId of expandedIds) {
                // Remove connections first
                const connections = editor.getConnections().filter(
                  c => c.source === expandedId || c.target === expandedId
                )
                for (const conn of connections) {
                  await editor.removeConnection(conn.id)
                }
                // Remove node
                await editor.removeNode(expandedId)
              }
              
              node.expanded = false
              delete (node as any).expandedNodeIds
            }
            
            collapseNodes()
          }
          return context // Don't process as selection
        }
      }
      
      if (!isMultiSelect) {
        // Clear previous selection
        selectedNodes.forEach(id => {
          const view = area.nodeViews.get(id)
          if (view?.element) {
            view.element.classList.remove('selected')
          }
        })
        selectedNodes.clear()
        setSelectedCount(0)
      }
      
      // Toggle selection for this node
      if (selectedNodes.has(nodeId)) {
        selectedNodes.delete(nodeId)
        const view = area.nodeViews.get(nodeId)
        if (view?.element) {
          view.element.classList.remove('selected')
        }
      } else {
        selectedNodes.add(nodeId)
        const view = area.nodeViews.get(nodeId)
        if (view?.element) {
          view.element.classList.add('selected')
        }
      }
      setSelectedCount(selectedNodes.size)
    }
    
    // Listen for zoom events
    if (context.type === 'zoom') {
      const { zoom } = context.data
      currentZoom = zoom
      // Force re-render of nodes at new zoom level
      editor.getNodes().forEach(node => {
        area.update('node', node.id)
      })
      // Update groups on zoom
      if (updateGroups) {
        setTimeout(updateGroups, 50)
      }
    }
    return context
  })
  
  // Add connection presets
  connection.addPreset(ConnectionPresets.classic.setup())
  
  // Add render presets - use default for now to test connections
  render.addPreset(ReactPresets.classic.setup())
  
  // Enable selectable nodes with accumulation
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl()
  })
  
  // Zoom to fit initial view
  await AreaExtensions.zoomAt(area, editor.getNodes())
  
  // Add group rendering with zoom awareness
  updateGroups = () => {
    const nodes = editor.getNodes()
    const groups: Record<string, Node[]> = {}
    
    // Don't show groups when very zoomed out
    if (currentZoom < 0.3) return
    
    // Group nodes by their prefix property (which stores the exact prefix used)
    nodes.forEach(node => {
      const typedNode = node as DeadCellNode | DeadPropagatorNode
      const prefix = typedNode.prefix || 'main'
      if (!prefix) return
      
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(node)
      
      // Also add to parent groups (e.g., node with prefix 'main.bar' also belongs to 'main')
      const parts = prefix.split('.')
      let currentPrefix = ''
      for (let i = 0; i < parts.length - 1; i++) {
        currentPrefix = i === 0 ? parts[i] : currentPrefix + '.' + parts[i]
        if (!groups[currentPrefix]) groups[currentPrefix] = []
        if (!groups[currentPrefix].includes(node)) {
          groups[currentPrefix].push(node)
        }
      }
    })
    
    // Remove old group elements
    const oldGroups = container.querySelectorAll('.group-boundary')
    oldGroups.forEach(el => el.remove())
    
    // Sort prefixes by depth (deeper prefixes first) so parent groups render behind children
    const sortedPrefixes = Object.keys(groups).sort((a, b) => {
      const depthA = a.split('.').length
      const depthB = b.split('.').length
      return depthA - depthB  // Lower depth first (parents before children)
    })
    
    // Add group boundaries
    sortedPrefixes.forEach(prefix => {
      const groupNodes = groups[prefix]
      if (!groupNodes || groupNodes.length < 1) return
      
      // Calculate bounds
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity
      
      groupNodes?.forEach(node => {
        const view = area.nodeViews.get(node.id)
        if (view && view.position) {
          minX = Math.min(minX, view.position.x)
          minY = Math.min(minY, view.position.y)
          maxX = Math.max(maxX, view.position.x + 200)
          maxY = Math.max(maxY, view.position.y + 100)
        }
      })
      
      // Determine nesting level for styling
      const nestLevel = prefix.split('.').length - 1
      
      // Adjust group appearance based on zoom level
      const zoomFactor = Math.min(Math.max(currentZoom, 0.3), 2)
      const padding = (30 + (nestLevel * 15)) * zoomFactor
      const opacity = Math.max(0.02, 0.05 - (nestLevel * 0.015))
      const borderOpacity = Math.max(0.2, (0.3 - (nestLevel * 0.05)) * zoomFactor)
      const zIndex = -10 - nestLevel
      
      // Create group element
      const groupEl = document.createElement('div')
      groupEl.className = 'group-boundary'
      groupEl.dataset['prefix'] = prefix
      groupEl.style.cssText = `
        position: absolute;
        left: ${minX - padding}px;
        top: ${minY - padding - 20}px;
        width: ${maxX - minX + (padding * 2)}px;
        height: ${maxY - minY + (padding * 2) + 20}px;
        border: 2px dashed rgba(100, 100, 100, ${borderOpacity});
        border-radius: ${12 + nestLevel * 4}px;
        background: rgba(100, 100, 100, ${opacity});
        pointer-events: none;
        z-index: ${zIndex};
      `
      
      // Add label
      const label = document.createElement('div')
      label.textContent = prefix
      label.style.cssText = `
        position: absolute;
        top: -24px;
        left: 10px;
        padding: 2px 8px;
        background: white;
        border: 1px solid rgba(100, 100, 100, ${borderOpacity});
        border-radius: 4px;
        font-size: ${12 - Math.min(nestLevel, 2)}px;
        font-weight: ${600 - Math.min(nestLevel * 100, 200)};
        color: rgba(102, 102, 102, ${1 - nestLevel * 0.2});
      `
      groupEl.appendChild(label)
      
      // Add to area using Rete's content API
      area.area.content.add(groupEl)
    })
  }
  
  // Update groups when nodes change
  editor.addPipe((context) => {
    if (context.type === 'nodecreated' || context.type === 'noderemoved') {
      setTimeout(updateGroups, 100)
    }
    return context
  })
  
  // Update groups on translate
  area.addPipe((context) => {
    if (context.type === 'nodetranslated') {
      setTimeout(updateGroups, 100)
    }
    return context
  })
  
  // Initial group update
  setTimeout(updateGroups, 500)
  
  // Return editor with area attached
  return Object.assign(editor, { area })
}

// Export function
function exportToIR(editor: NodeEditor<Schemes>): DeadNetworkExport {
  const nodes = editor.getNodes()
  const connections = editor.getConnections()
  
  const cells = nodes
    .filter(n => n instanceof DeadCellNode)
    .map(n => {
      const cell = n as DeadCellNode
      // Get connected inputs
      const inputs = connections
        .filter(c => c.target === cell.id)
        .map(c => c.source)
      
      // Get connected outputs
      const outputs = connections
        .filter(c => c.source === cell.id)
        .map(c => c.target)
        
      return {
        id: cell.id,
        merge: cell.mergeFunction || 'last',
        inputs,
        outputs
      }
    })
    
  const propagators = nodes
    .filter(n => n instanceof DeadPropagatorNode)
    .map(n => {
      const prop = n as DeadPropagatorNode
      // Get connected inputs
      const inputs = connections
        .filter(c => c.target === prop.id)
        .map(c => c.source)
      
      // Get connected outputs
      const outputs = connections
        .filter(c => c.source === prop.id)
        .map(c => c.target)
        
      return {
        id: prop.id,
        fn: prop.functionType,
        inputs,
        outputs
      }
    })
    
  // Export connections with port details
  const connectionDetails = connections.map(conn => ({
    source: conn.source,
    sourceOutput: conn.sourceOutput,
    target: conn.target,
    targetInput: conn.targetInput
  }))
  
  const prefixes = [...new Set(nodes.map((n: any) => n.prefix).filter(Boolean))]
  
  return {
    cells,
    propagators,
    connections: connectionDetails,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      prefixes
    }
  }
}

// Import function
async function importFromIR(editor: NodeEditor<Schemes>, data: DeadNetworkExport) {
  const area = (editor as any).area
  
  // Clear existing
  await editor.clear()
  
  // Create cells
  for (const cellData of data.cells) {
    const cell = new DeadCellNode(cellData.id.split('.').pop() || 'cell')
    cell.id = cellData.id
    cell.prefix = cellData.id.split('.').slice(0, -1).join('.') || 'main'
    cell.mergeFunction = cellData.merge
    await editor.addNode(cell)
  }
  
  // Create propagators
  for (const propData of data.propagators) {
    const prop = new DeadPropagatorNode(
      propData.id.split('.').pop() || 'propagator',
      propData.fn
    )
    prop.id = propData.id
    prop.prefix = propData.id.split('.').slice(0, -1).join('.') || 'main'
    await editor.addNode(prop)
  }
  
  // Position nodes in a grid
  const nodes = editor.getNodes()
  nodes.forEach((node, i) => {
    const x = (i % 4) * 250
    const y = Math.floor(i / 4) * 150
    area.translate(node.id, { x, y })
  })
  
  // Create connections
  for (const connData of data.connections) {
    const sourceNode = editor.getNode(connData.source)
    const targetNode = editor.getNode(connData.target)
    if (sourceNode && targetNode) {
      const sourceSocket = sourceNode.outputs[connData.sourceOutput]
      const targetSocket = targetNode.inputs[connData.targetInput]
      if (sourceSocket && targetSocket) {
        const connection = new ClassicPreset.Connection(
          sourceNode,
          connData.sourceOutput,
          targetNode,
          connData.targetInput
        )
        await editor.addConnection(connection)
      }
    }
  }
  
  await AreaExtensions.zoomAt(area, editor.getNodes())
}

// Main component
export default function DeadEditorRoute() {
  const [editor, setEditor] = useState<NodeEditor<Schemes> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentPrefix, setCurrentPrefix] = useState('main')
  const [filterPrefix, setFilterPrefix] = useState('')
  const [availablePrefixes, setAvailablePrefixes] = useState(['main'])
  const nodeCounterRef = useRef({ cell: 0, propagator: 0, macro: 0 })
  const selectedNodesRef = useRef<Set<string>>(new Set())
  const [selectedCount, setSelectedCount] = useState(0)
  const [currentZoom, setCurrentZoom] = useState(1)
  
  // Subscribe to zoom changes from the editor
  useEffect(() => {
    if (!editor) return
    const area = (editor as any).area
    if (!area) return
    
    area.addPipe((context: any) => {
      if (context.type === 'zoom') {
        setCurrentZoom(context.data.zoom)
      }
      return context
    })
  }, [editor])
  
  // Update available prefixes whenever nodes change
  useEffect(() => {
    if (!editor) return
    
    const updatePrefixes = () => {
      const nodes = editor.getNodes()
      const prefixes = new Set<string>()
      
      nodes.forEach(node => {
        const typedNode = node as DeadCellNode | DeadPropagatorNode
        if (typedNode.prefix) {
          // Add the exact prefix
          prefixes.add(typedNode.prefix)
          
          // Also add all parent prefixes
          const parts = typedNode.prefix.split('.')
          let currentPrefix = ''
          for (let i = 0; i < parts.length; i++) {
            currentPrefix = i === 0 ? parts[i] : currentPrefix + '.' + parts[i]
            prefixes.add(currentPrefix)
          }
        }
      })
      
      setAvailablePrefixes(Array.from(prefixes).sort())
    }
    
    editor.addPipe((context) => {
      if (context.type === 'nodecreated' || context.type === 'noderemoved') {
        updatePrefixes()
      }
      return context
    })
    
    updatePrefixes()
  }, [editor])
  
  // Apply filtering
  useEffect(() => {
    if (!editor) return
    const area = (editor as any).area
    if (!area) return
    
    const nodes = editor.getNodes()
    nodes.forEach(node => {
      const typedNode = node as DeadCellNode | DeadPropagatorNode
      const nodeElement = area.nodeViews.get(node.id)?.element
      
      if (nodeElement) {
        if (filterPrefix && !typedNode.prefix?.startsWith(filterPrefix)) {
          nodeElement.style.opacity = '0.3'
          typedNode.hidden = true
        } else {
          nodeElement.style.opacity = '1'
          typedNode.hidden = false
        }
      }
    })
  }, [filterPrefix, editor])
  
  // Initialize editor
  useEffect(() => {
    if (containerRef.current && !editor) {
      createDeadEditor(selectedNodesRef, setSelectedCount)(containerRef.current).then(setEditor)
    }
  }, [])
  
  const addCell = async () => {
    if (!editor) return
    const area = (editor as any).area
    const count = ++nodeCounterRef.current.cell
    const id = `${currentPrefix}.cell_${count}`
    const cell = new DeadCellNode(`cell_${count}`)
    cell.id = id
    cell.prefix = currentPrefix
    await editor.addNode(cell)
    
    // Position randomly near center
    const x = 400 + Math.random() * 200 - 100
    const y = 300 + Math.random() * 200 - 100
    await area.translate(cell.id, { x, y })
  }
  
  const addPropagator = async (fnType: string) => {
    if (!editor) return
    const area = (editor as any).area
    const count = ++nodeCounterRef.current.propagator
    const id = `${currentPrefix}.${fnType}_${count}`
    const prop = new DeadPropagatorNode(`${fnType}_${count}`, fnType)
    prop.id = id
    prop.prefix = currentPrefix
    await editor.addNode(prop)
    
    // Position randomly near center
    const x = 400 + Math.random() * 200 - 100
    const y = 300 + Math.random() * 200 - 100
    await area.translate(prop.id, { x, y })
  }
  
  const handleExport = () => {
    if (!editor) return
    const data = exportToIR(editor)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'network.json'
    a.click()
  }
  
  const handleCopy = () => {
    if (!editor) return
    const data = exportToIR(editor)
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }
  
  const handlePaste = async () => {
    if (!editor) return
    try {
      const text = await navigator.clipboard.readText()
      const data = JSON.parse(text)
      await importFromIR(editor, data)
    } catch (err) {
      console.error('Failed to paste:', err)
    }
  }
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        await importFromIR(editor, data)
      } catch (err) {
        console.error('Failed to import:', err)
      }
    }
    reader.readAsText(file)
  }
  
  const getZoomLevel = () => {
    if (currentZoom < 0.3) return 'dot'
    if (currentZoom < 0.6) return 'compact'
    if (currentZoom < 1.5) return 'normal'
    if (currentZoom < 3) return 'detailed'
    return 'internal'
  }
  
  const createMacroFromSelection = async () => {
    const selectedNodes = selectedNodesRef.current
    if (!editor || selectedNodes.size === 0) return
    const area = (editor as any).area
    
    // Get selected nodes and their connections
    const selectedNodeObjects: Array<{
      id: string
      type: 'cell' | 'propagator' | 'macro'
      label: string
      prefix: string
      data: any
    }> = []
    
    const internalConnections: Array<{
      source: string
      target: string
      sourceOutput: string
      targetInput: string
    }> = []
    
    selectedNodes.forEach((nodeId: string) => {
      const node = editor.getNode(nodeId)
      if (node) {
        const typedNode = node as DeadCellNode | DeadPropagatorNode | DeadMacroNode
        selectedNodeObjects.push({
          id: nodeId,
          type: node instanceof DeadCellNode ? 'cell' : 
                node instanceof DeadPropagatorNode ? 'propagator' : 'macro',
          label: node.label,
          prefix: typedNode.prefix,
          data: node instanceof DeadPropagatorNode ? { functionType: (node as DeadPropagatorNode).functionType } : 
                node instanceof DeadCellNode ? { mergeFunction: (node as DeadCellNode).mergeFunction } : 
                { template: (node as DeadMacroNode).template }
        })
      }
    })
    
    // Get all connections between selected nodes
    const allConnections = editor.getConnections()
    allConnections.forEach(conn => {
      const sourceSelected = selectedNodes.has(conn.source)
      const targetSelected = selectedNodes.has(conn.target)
      
      if (sourceSelected || targetSelected) {
        internalConnections.push({
          source: conn.source,
          target: conn.target,
          sourceOutput: conn.sourceOutput,
          targetInput: conn.targetInput
        })
      }
    })
    
    // Create macro node with template
    const macroName = prompt('Enter macro name:') || 'macro'
    const count = ++nodeCounterRef.current.macro
    const macroId = `${currentPrefix}.macro_${count}`
    
    const template = {
      nodes: selectedNodeObjects,
      connections: internalConnections
    }
    
    const macro = new DeadMacroNode(`${macroName}_${count}`, template)
    macro.id = macroId
    macro.prefix = currentPrefix
    
    // Add macro node
    await editor.addNode(macro)
    
    // Position macro at center of selected nodes
    let avgX = 0, avgY = 0
    for (const nodeId of selectedNodes) {
      const pos = await area.nodeViews.get(nodeId)?.position
      if (pos) {
        avgX += pos.x
        avgY += pos.y
      }
    }
    avgX /= selectedNodes.size
    avgY /= selectedNodes.size
    
    await area.translate(macro.id, { x: avgX, y: avgY })
    
    // Remove original nodes
    for (const nodeId of selectedNodes) {
      await editor.removeNode(nodeId)
    }
    
    selectedNodes.clear()
    setSelectedCount(0)
  }
  
  return (
    <>
      <style>{`
        .selected {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 2px;
        }
        .rete-node.selected {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
        }
      `}</style>
      <div className="flex h-screen">
        {/* Canvas */}
        <div className="flex-1 relative bg-gray-50">
          <div ref={containerRef} className="w-full h-full" />
          
          {/* Zoom indicator */}
          <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded shadow text-sm">
            Zoom: {(currentZoom * 100).toFixed(0)}% ({getZoomLevel()})
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4">DEAD Editor</h2>
          
          {/* Prefix selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Current Prefix:</label>
            <input
              type="text"
              value={currentPrefix}
              onChange={(e) => setCurrentPrefix(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
              placeholder="main"
            />
          </div>
          
          {/* Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Filter by Prefix:</label>
            <select
              value={filterPrefix}
              onChange={(e) => setFilterPrefix(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="">Show All</option>
              {availablePrefixes.map(prefix => (
                <option key={prefix} value={prefix}>{prefix}</option>
              ))}
            </select>
          </div>
          
          {/* Node creation */}
          <div className="mb-4">
            <h3 className="font-medium mb-2">Add Nodes:</h3>
            <button
              onClick={addCell}
              className="w-full mb-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Cell
            </button>
            
            <div className="space-y-1">
              {['identity', 'add', 'multiply', 'subtract', 'divide', 'clamp', 'compare'].map(fnType => (
                <button
                  key={fnType}
                  onClick={() => addPropagator(fnType)}
                  className="w-full px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Add {fnType}
                </button>
              ))}
            </div>
          </div>
          
          {/* Macro operations */}
          <div className="mb-4 border-t pt-4">
            <h3 className="font-medium mb-2">Macros:</h3>
            <button
              onClick={createMacroFromSelection}
              disabled={selectedCount === 0}
              className="w-full mb-2 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Macro from Selection
              {selectedCount > 0 && ` (${selectedCount})`}
            </button>
          </div>
          
          {/* Import/Export */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Import/Export:</h3>
            <button
              onClick={handleExport}
              className="w-full mb-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Export JSON
            </button>
            <button
              onClick={handleCopy}
              className="w-full mb-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={handlePaste}
              className="w-full mb-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Paste from Clipboard
            </button>
            <label className="block w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer text-center">
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </>
  )
}