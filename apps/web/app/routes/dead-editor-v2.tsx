import { useState, useCallback, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { NodeEditor, ClassicPreset } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { ReactPlugin, Presets as ReactPresets, useRete } from 'rete-react-plugin'
import type { ReactArea2D } from 'rete-react-plugin'

// Node socket
const socket = new ClassicPreset.Socket('socket')

// Custom node class for DEAD editor
class DeadCellNode extends ClassicPreset.Node {
  prefix: string
  mergeFunction: string = 'last'
  
  constructor(label: string) {
    super(label)
    this.prefix = 'main'
    
    this.addInput('in', new ClassicPreset.Input(socket, 'Input', true))
    this.addOutput('out', new ClassicPreset.Output(socket, 'Output', true))
    
    this.addControl('merge', new ClassicPreset.InputControl('text', {
      initial: this.mergeFunction,
      change: (value) => { this.mergeFunction = String(value) }
    }))
  }
}

class DeadPropagatorNode extends ClassicPreset.Node {
  prefix: string
  functionType: string
  
  constructor(label: string, fn: string = 'identity') {
    super(label)
    this.prefix = 'main'
    this.functionType = fn
    
    this.addInput('in', new ClassicPreset.Input(socket, 'Input', true))
    this.addOutput('out', new ClassicPreset.Output(socket, 'Output', true))
    
    this.addControl('function', new ClassicPreset.InputControl('text', {
      initial: this.functionType,
      change: (value) => { this.functionType = String(value) }
    }))
  }
}

type Node = DeadCellNode | DeadPropagatorNode
type Conn = ClassicPreset.Connection<Node, Node>
type Schemes = {
  Node: Node
  Connection: Conn
}

// Export format
interface DeadNetworkExport {
  cells: Array<{
    id: string
    merge: string
    initial?: any
    position?: { x: number; y: number }
  }>
  propagators: Array<{
    id: string
    fn: string
    inputs: string[]
    outputs: string[]
    position?: { x: number; y: number }
  }>
  metadata?: {
    created: string
    version: string
    prefixes?: string[]
  }
}

// Create editor factory  
const createDeadEditor = () => async (container: HTMLElement) => {
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
  
  // Listen for zoom events
  area.addPipe((context) => {
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
  
  // Add render presets with custom node components
  render.addPreset(ReactPresets.classic.setup({
    customize: {
      node(context) {
        const node = context.payload
        const displayName = node.id  // Show full ID including prefix
        
        // Determine zoom level for semantic rendering
        const getZoomLevel = () => {
          if (currentZoom < 0.3) return 'dot'        // Very zoomed out - just dots
          if (currentZoom < 0.6) return 'compact'    // Zoomed out - compact boxes
          if (currentZoom < 1.5) return 'normal'     // Normal view
          if (currentZoom < 3) return 'detailed'     // Zoomed in - show more detail
          return 'internal'                          // Very zoomed in - show internals
        }
        
        const zoomLevel = getZoomLevel()
        
        // Check if this is a group node (has child nodes with this prefix)
        const isGroupNode = (nodeId: string) => {
          const prefix = nodeId
          return editor.getNodes().some(n => {
            const typedNode = n as DeadCellNode | DeadPropagatorNode
            return typedNode.prefix?.startsWith(prefix + '.')
          })
        }
        
        const hasChildren = isGroupNode(node.id.substring(0, node.id.lastIndexOf('.')))
        
        if (node instanceof DeadCellNode) {
          return () => (
            <>
              {zoomLevel === 'dot' ? (
                // Very zoomed out - just a dot with tooltip
                <div 
                  data-node-id={node.id}
                  className="w-3 h-3 bg-blue-500 rounded-full"
                  title={displayName}
                />
              ) : zoomLevel === 'compact' ? (
                // Zoomed out - compact box
                <div 
                  data-node-id={node.id}
                  className="bg-blue-50 border border-blue-300 rounded px-2 py-1 min-w-[80px]"
                >
                  <div className="text-xs text-blue-900 truncate">{displayName}</div>
                </div>
              ) : zoomLevel === 'normal' || zoomLevel === 'detailed' ? (
                // Normal/Detailed view
                <div 
                  data-node-id={node.id}
                  className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 min-w-[180px]"
                >
                  <div className="font-medium text-blue-900">{displayName || 'cell'}</div>
                  {zoomLevel === 'detailed' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Merge:</label>
                      <select 
                        className="ml-1 text-xs border rounded px-1 py-0.5"
                        defaultValue={node.mergeFunction}
                        onChange={(e) => node.mergeFunction = e.target.value}
                      >
                        <option value="last">Last</option>
                        <option value="max">Max</option>
                        <option value="min">Min</option>
                        <option value="sum">Sum</option>
                        <option value="union">Union</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                // Internal view - show everything
                <div 
                  data-node-id={node.id}
                  className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 min-w-[220px]"
                >
                  <div className="font-bold text-blue-900 text-lg">{displayName || 'cell'}</div>
                  <div className="mt-3">
                    <label className="text-sm text-gray-600">Merge Function:</label>
                    <select 
                      className="ml-2 text-sm border rounded px-2 py-1 w-full mt-1"
                      defaultValue={node.mergeFunction}
                      onChange={(e) => node.mergeFunction = e.target.value}
                    >
                      <option value="last">Last Write Wins</option>
                      <option value="max">Maximum Value</option>
                      <option value="min">Minimum Value</option>
                      <option value="sum">Sum Values</option>
                      <option value="union">Union Set</option>
                    </select>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Type: Cell | Prefix: {node.prefix}
                  </div>
                </div>
              )}
            </>
          )
        }
        
        if (node instanceof DeadPropagatorNode) {
          return () => (
            <>
              {zoomLevel === 'dot' ? (
                // Very zoomed out - just a dot
                <div 
                  data-node-id={node.id}
                  className="w-3 h-3 bg-green-500 rounded-full"
                  title={displayName}
                />
              ) : zoomLevel === 'compact' ? (
                // Zoomed out - compact box
                <div 
                  data-node-id={node.id}
                  className="bg-green-50 border border-green-300 rounded px-2 py-1 min-w-[80px]"
                >
                  <div className="text-xs text-green-900 truncate">{displayName}</div>
                </div>
              ) : zoomLevel === 'normal' || zoomLevel === 'detailed' ? (
                // Normal/Detailed view
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 min-w-[180px]">
                  <div className="font-medium text-green-900">{displayName || 'propagator'}</div>
                  {zoomLevel === 'detailed' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Function:</label>
                      <select 
                        className="ml-1 text-xs border rounded px-1 py-0.5"
                        defaultValue={node.functionType}
                        onChange={(e) => node.functionType = e.target.value}
                      >
                        <option value="identity">Identity</option>
                        <option value="add">Add</option>
                        <option value="multiply">Multiply</option>
                        <option value="subtract">Subtract</option>
                        <option value="divide">Divide</option>
                        <option value="clamp">Clamp</option>
                        <option value="compare">Compare</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                // Internal view - show everything
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 min-w-[220px]">
                  <div className="font-bold text-green-900 text-lg">{displayName || 'propagator'}</div>
                  <div className="mt-3">
                    <label className="text-sm text-gray-600">Function Type:</label>
                    <select 
                      className="ml-2 text-sm border rounded px-2 py-1 w-full mt-1"
                      defaultValue={node.functionType}
                      onChange={(e) => node.functionType = e.target.value}
                    >
                      <option value="identity">Identity Function</option>
                      <option value="add">Addition (+)</option>
                      <option value="multiply">Multiplication (×)</option>
                      <option value="subtract">Subtraction (-)</option>
                      <option value="divide">Division (÷)</option>
                      <option value="clamp">Clamp Range</option>
                      <option value="compare">Comparison</option>
                    </select>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Type: Propagator | Prefix: {node.prefix}
                  </div>
                </div>
              )}
            </>
          )
        }
      }
    }
  }))
  
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
    if (currentZoom < 0.5) return
    
    // Group nodes by their prefix property (which stores the exact prefix used)
    nodes.forEach(node => {
      const typedNode = node as DeadCellNode | DeadPropagatorNode
      const prefix = typedNode.prefix
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
      if (groupNodes.length < 1) return
      
      // Calculate bounds
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity
      
      groupNodes.forEach(node => {
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
      groupEl.dataset.prefix = prefix
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
  setTimeout(updateGroups, 100)
  
  // Return editor with area attached
  return Object.assign(editor, { area })
}

// Export function
function exportToIR(editor: NodeEditor<Schemes>): DeadNetworkExport {
  const nodes = editor.getNodes()
  const connections = editor.getConnections()
  
  const cells = nodes
    .filter(n => n instanceof DeadCellNode)
    .map(n => ({
      id: n.id,
      merge: (n as DeadCellNode).mergeFunction,
      initial: null
    }))
  
  const propagators = nodes
    .filter(n => n instanceof DeadPropagatorNode)
    .map(n => {
      const inputs = connections
        .filter(c => c.target === n.id)
        .map(c => c.source)
      const outputs = connections
        .filter(c => c.source === n.id)
        .map(c => c.target)
      
      return {
        id: n.id,
        fn: (n as DeadPropagatorNode).functionType,
        inputs,
        outputs
      }
    })
  
  const prefixes = [...new Set(nodes.map(n => n.id.split('.')[0]))].sort()
  
  return {
    cells,
    propagators,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      prefixes
    }
  }
}

// Import function
async function importFromIR(ir: DeadNetworkExport, editor: NodeEditor<Schemes>, area: AreaPlugin<Schemes, ReactArea2D<Schemes>>) {
  await editor.clear()
  
  // Create nodes
  for (const cell of ir.cells) {
    const [prefix, ...rest] = cell.id.split('.')
    const label = rest.join('.') || cell.id
    const node = new DeadCellNode(label)
    node.id = cell.id
    node.prefix = prefix || 'main'
    node.mergeFunction = cell.merge
    await editor.addNode(node)
    await area.translate(node.id, { x: Math.random() * 600, y: Math.random() * 400 })
  }
  
  for (const prop of ir.propagators) {
    const [prefix, ...rest] = prop.id.split('.')
    const label = rest.join('.') || prop.id
    const node = new DeadPropagatorNode(label, prop.fn)
    node.id = prop.id
    node.prefix = prefix || 'main'
    await editor.addNode(node)
    await area.translate(node.id, { x: Math.random() * 600, y: Math.random() * 400 })
    
    // Create connections
    for (const inputId of prop.inputs) {
      const inputNode = editor.getNode(inputId)
      if (inputNode) {
        await editor.addConnection(new ClassicPreset.Connection(inputNode, 'out', node, 'in'))
      }
    }
    
    for (const outputId of prop.outputs) {
      const outputNode = editor.getNode(outputId)
      if (outputNode) {
        await editor.addConnection(new ClassicPreset.Connection(node, 'out', outputNode, 'in'))
      }
    }
  }
  
  // Fit to view
  await AreaExtensions.zoomAt(area, editor.getNodes())
}


// Main component
export default function DeadEditorV2() {
  const createEditorFactory = useCallback(createDeadEditor(), [])
  const [ref, editor] = useRete(createEditorFactory)
  const [selectedPrefix, setSelectedPrefix] = useState('main')
  const [showPreview, setShowPreview] = useState(false)
  const [nodes, setNodes] = useState<Node[]>([])
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [availablePrefixes, setAvailablePrefixes] = useState<string[]>(['main'])
  const [currentZoom, setCurrentZoom] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nodeCounter = useRef(0)
  
  const addNode = useCallback(async (type: 'cell' | 'propagator', fn?: string) => {
    if (!editor) return
    const area = (editor as any).area
    
    nodeCounter.current++
    const id = `${selectedPrefix}.${type}_${nodeCounter.current}`
    const label = `${type}_${nodeCounter.current}`
    
    const node = type === 'cell' 
      ? new DeadCellNode(label)
      : new DeadPropagatorNode(label, fn || 'identity')
    
    // Manually set the ID and prefix
    node.id = id
    node.prefix = selectedPrefix
    
    await editor.addNode(node)
    await area.translate(node.id, {
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 400
    })
  }, [editor, selectedPrefix])
  
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
          prefixes.add(typedNode.prefix)
          // Also add parent prefixes
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
    
    // Update on node changes
    editor.addPipe((context) => {
      if (context.type === 'nodecreated' || context.type === 'noderemoved') {
        setTimeout(updatePrefixes, 100)
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
        if (activeFilter === null) {
          // Show all nodes
          nodeElement.style.opacity = '1'
          nodeElement.style.pointerEvents = 'auto'
        } else if (typedNode.prefix === activeFilter || typedNode.prefix?.startsWith(activeFilter + '.')) {
          // Show nodes matching filter
          nodeElement.style.opacity = '1'
          nodeElement.style.pointerEvents = 'auto'
        } else {
          // Hide nodes not matching filter
          nodeElement.style.opacity = '0.2'
          nodeElement.style.pointerEvents = 'none'
        }
      }
    })
    
    // Update connections visibility
    const connections = editor.getConnections()
    connections.forEach(conn => {
      const sourceNode = editor.getNode(conn.source) as DeadCellNode | DeadPropagatorNode
      const targetNode = editor.getNode(conn.target) as DeadCellNode | DeadPropagatorNode
      const connElement = area.connectionViews.get(conn.id)?.element
      
      if (connElement) {
        if (activeFilter === null) {
          connElement.style.opacity = '1'
        } else if (
          (sourceNode?.prefix === activeFilter || sourceNode?.prefix?.startsWith(activeFilter + '.')) &&
          (targetNode?.prefix === activeFilter || targetNode?.prefix?.startsWith(activeFilter + '.'))
        ) {
          connElement.style.opacity = '1'
        } else {
          connElement.style.opacity = '0.1'
        }
      }
    })
  }, [editor, activeFilter])
  
  const handleExport = () => {
    if (!editor) return
    const ir = exportToIR(editor)
    const blob = new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleCopy = () => {
    if (!editor) return
    const ir = exportToIR(editor)
    navigator.clipboard.writeText(JSON.stringify(ir, null, 2))
  }
  
  const handlePaste = async () => {
    if (!editor) return
    const area = (editor as any).area
    try {
      const text = await navigator.clipboard.readText()
      const ir = JSON.parse(text) as DeadNetworkExport
      await importFromIR(ir, editor, area)
    } catch (err) {
      console.error('Failed to paste:', err)
      alert('Failed to paste from clipboard. Make sure you have valid JSON copied.')
    }
  }
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return
    const area = (editor as any).area
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const ir = JSON.parse(e.target?.result as string) as DeadNetworkExport
        await importFromIR(ir, editor, area)
      } catch (err) {
        console.error('Failed to import:', err)
        alert('Failed to import file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }
  
  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden">
      {/* Controls Panel */}
      <div className="absolute top-4 left-4 z-20 space-y-3">
        {/* Zoom indicator */}
        <div className="bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="text-xs font-semibold text-gray-600">Zoom: {Math.round(currentZoom * 100)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {currentZoom < 0.3 ? 'Overview' : 
             currentZoom < 0.6 ? 'Compact' : 
             currentZoom < 1.5 ? 'Normal' : 
             currentZoom < 3 ? 'Detailed' : 'Internal'}
          </div>
        </div>
        
        {/* Prefix selector & Filter */}
        <div className="bg-white rounded-lg shadow-lg p-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Current Prefix:</label>
            <input
              type="text"
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
              className="ml-2 px-2 py-1 border rounded text-sm"
              placeholder="e.g., auth, ui, data"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-600">Filter by Prefix:</label>
            <select
              value={activeFilter || ''}
              onChange={(e) => setActiveFilter(e.target.value || null)}
              className="ml-2 px-2 py-1 border rounded text-sm w-full mt-1"
            >
              <option value="">Show All</option>
              {availablePrefixes.map(prefix => (
                <option key={prefix} value={prefix}>
                  {prefix} {activeFilter === prefix ? '✓' : ''}
                </option>
              ))}
            </select>
            {activeFilter && (
              <div className="mt-1 text-xs text-gray-500">
                Showing: {activeFilter}.*
              </div>
            )}
          </div>
        </div>
        
        {/* Node Palette */}
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="text-sm font-semibold mb-3">Add Nodes</h3>
          
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-600 mb-2">Cells</h4>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => addNode('cell')} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs">Cell</button>
              <button onClick={() => addNode('cell')} className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-xs">Max Cell</button>
              <button onClick={() => addNode('cell')} className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-xs">Min Cell</button>
              <button onClick={() => addNode('cell')} className="px-2 py-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded text-xs">Sum Cell</button>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2">Propagators</h4>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => addNode('propagator', 'add')} className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs">Add</button>
              <button onClick={() => addNode('propagator', 'multiply')} className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs">Multiply</button>
              <button onClick={() => addNode('propagator', 'clamp')} className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-xs">Clamp</button>
              <button onClick={() => addNode('propagator', 'compare')} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs">Compare</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Export Panel */}
      <div className="absolute top-4 right-4 z-20 bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Import/Export</h3>
        
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">
            📥 Download JSON
          </button>
          
          <button onClick={handleCopy} className="w-full px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">
            📋 Copy to Clipboard
          </button>
          
          <button onClick={handlePaste} className="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm">
            📋 Paste from Clipboard
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} className="w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm">
            📤 Import from File
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          
          <button onClick={() => setShowPreview(!showPreview)} className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm">
            {showPreview ? '🙈 Hide' : '👁️ Show'} Preview
          </button>
        </div>
        
        {showPreview && editor && (
          <div className="mt-3 p-2 bg-gray-50 rounded border">
            <pre className="text-xs overflow-auto max-h-64">
              {JSON.stringify(exportToIR(editor), null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Rete editor container */}
      <div ref={ref} className="w-full h-full" />
    </div>
  )
}