import { useState, useCallback, useRef } from 'react'

// Simple types for our DEAD editor
interface DeadNode {
  id: string
  type: 'cell' | 'propagator'
  prefix: string
  x: number
  y: number
  data: {
    merge?: string
    fn?: string
    initial?: any
  }
}

interface DeadConnection {
  id: string
  source: string
  target: string
}

interface DeadNetworkExport {
  cells: Array<{
    id: string
    merge: string
    initial?: any
  }>
  propagators: Array<{
    id: string
    fn: string
    inputs: string[]
    outputs: string[]
  }>
  metadata?: {
    created: string
    version: string
    prefixes?: string[]
  }
}

// Node ID generator
let nodeCounter = 0
const generateNodeId = (prefix: string, type: string) => {
  return `${prefix}.${type}_${++nodeCounter}`
}

// Export function
function exportToIR(nodes: DeadNode[], connections: DeadConnection[]): DeadNetworkExport {
  const cells = nodes
    .filter(n => n.type === 'cell')
    .map(n => ({
      id: n.id,
      merge: n.data.merge || 'last',
      initial: n.data.initial
    }))
  
  const propagators = nodes
    .filter(n => n.type === 'propagator')
    .map(n => {
      const inputs = connections
        .filter(c => c.target === n.id)
        .map(c => c.source)
      const outputs = connections
        .filter(c => c.source === n.id)
        .map(c => c.target)
      
      return {
        id: n.id,
        fn: n.data.fn || 'identity',
        inputs,
        outputs
      }
    })
  
  const prefixes = [...new Set(nodes.map(n => n.prefix))].sort()
  
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
function importFromIR(ir: DeadNetworkExport): { nodes: DeadNode[], connections: DeadConnection[] } {
  const nodes: DeadNode[] = []
  const connections: DeadConnection[] = []
  
  // Create cell nodes
  ir.cells.forEach((cell, i) => {
    const prefix = cell.id.split('.')[0] || 'main'
    nodes.push({
      id: cell.id,
      type: 'cell',
      prefix,
      x: 100 + (i % 5) * 200,
      y: 100 + Math.floor(i / 5) * 150,
      data: {
        merge: cell.merge,
        initial: cell.initial
      }
    })
  })
  
  // Create propagator nodes
  ir.propagators.forEach((prop, i) => {
    const prefix = prop.id.split('.')[0] || 'main'
    nodes.push({
      id: prop.id,
      type: 'propagator',
      prefix,
      x: 100 + (i % 5) * 200,
      y: 400 + Math.floor(i / 5) * 150,
      data: {
        fn: prop.fn
      }
    })
    
    // Create connections
    prop.inputs.forEach(inputId => {
      connections.push({
        id: `${inputId}->${prop.id}`,
        source: inputId,
        target: prop.id
      })
    })
    
    prop.outputs.forEach(outputId => {
      connections.push({
        id: `${prop.id}->${outputId}`,
        source: prop.id,
        target: outputId
      })
    })
  })
  
  return { nodes, connections }
}

export default function DeadEditor() {
  const [nodes, setNodes] = useState<DeadNode[]>([])
  const [connections, setConnections] = useState<DeadConnection[]>([])
  const [selectedPrefix, setSelectedPrefix] = useState('main')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  
  // Add node
  const addNode = useCallback((type: 'cell' | 'propagator', fn?: string) => {
    const id = generateNodeId(selectedPrefix, type)
    const newNode: DeadNode = {
      id,
      type,
      prefix: selectedPrefix,
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 400,
      data: type === 'cell' 
        ? { merge: 'last' }
        : { fn: fn || 'identity' }
    }
    setNodes(prev => [...prev, newNode])
  }, [selectedPrefix])
  
  // Handle node click
  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    // Don't trigger click if we were dragging
    if (isDraggingNode) return
    
    if (connectingFrom) {
      // Create connection
      if (connectingFrom !== nodeId) {
        const connId = `${connectingFrom}->${nodeId}`
        setConnections(prev => [...prev, { id: connId, source: connectingFrom, target: nodeId }])
      }
      setConnectingFrom(null)
    } else {
      setSelectedNode(nodeId)
    }
  }, [connectingFrom, isDraggingNode])
  
  // Handle export
  const handleExport = () => {
    const ir = exportToIR(nodes, connections)
    const blob = new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Handle copy
  const handleCopy = () => {
    const ir = exportToIR(nodes, connections)
    navigator.clipboard.writeText(JSON.stringify(ir, null, 2))
  }
  
  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const ir = JSON.parse(text) as DeadNetworkExport
      const imported = importFromIR(ir)
      setNodes(imported.nodes)
      setConnections(imported.connections)
    } catch (err) {
      console.error('Failed to paste:', err)
      alert('Failed to paste from clipboard. Make sure you have valid JSON copied.')
    }
  }
  
  // Handle import
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ir = JSON.parse(e.target?.result as string) as DeadNetworkExport
        const imported = importFromIR(ir)
        setNodes(imported.nodes)
        setConnections(imported.connections)
      } catch (err) {
        console.error('Failed to import:', err)
        alert('Failed to import file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }
  
  // Get groups based on prefixes
  const groups = nodes.reduce((acc, node) => {
    if (!acc[node.prefix]) acc[node.prefix] = []
    acc[node.prefix].push(node)
    return acc
  }, {} as Record<string, DeadNode[]>)
  
  // Get node display based on zoom level
  const getNodeDisplay = (node: DeadNode) => {
    if (zoomLevel < 0.5) return 'dot'
    if (zoomLevel < 0.8) return 'compact'
    return 'full'
  }
  
  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.001
    const newZoom = Math.min(Math.max(0.1, zoomLevel + delta), 3)
    
    // Get mouse position relative to the container
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Calculate the point in the canvas that the mouse is over
    const canvasX = (mouseX - panOffset.x) / zoomLevel
    const canvasY = (mouseY - panOffset.y) / zoomLevel
    
    // Calculate new pan offset to keep the same point under the mouse
    const newPanX = mouseX - canvasX * newZoom
    const newPanY = mouseY - canvasY * newZoom
    
    setPanOffset({ x: newPanX, y: newPanY })
    setZoomLevel(newZoom)
  }, [zoomLevel, panOffset])
  
  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse or shift+left click for pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setIsPanning(true)
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }, [panOffset])
  
  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    } else if (isDraggingNode) {
      // Move the node using stored offset
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left - panOffset.x) / zoomLevel
      const mouseY = (e.clientY - rect.top - panOffset.y) / zoomLevel
      
      setNodes(prev => prev.map(node => 
        node.id === isDraggingNode 
          ? { ...node, x: mouseX - dragStart.x, y: mouseY - dragStart.y }
          : node
      ))
    }
  }, [isPanning, isDraggingNode, dragStart, panOffset, zoomLevel])
  
  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    setIsDraggingNode(null)
  }, [])
  
  // Handle node mouse down  
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button === 0 && !e.shiftKey) {
      setIsDraggingNode(nodeId)
      // Store the offset from the node's top-left to where we clicked
      const nodeElement = e.currentTarget as HTMLElement
      const rect = nodeElement.getBoundingClientRect()
      const nodeRect = nodeElement.getBoundingClientRect()
      
      // Get click position relative to the node
      const offsetX = e.clientX - nodeRect.left
      const offsetY = e.clientY - nodeRect.top
      
      // Store these offsets scaled by zoom
      setDragStart({ 
        x: offsetX / zoomLevel, 
        y: offsetY / zoomLevel 
      })
    }
  }, [zoomLevel])
  
  return (
    <div 
      className="relative w-full h-screen bg-gray-50 overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : isDraggingNode ? 'move' : 'default' }}>
      {/* Controls Panel */}
      <div className="absolute top-4 left-4 z-20 space-y-3">
        {/* Prefix selector */}
        <div className="bg-white rounded-lg shadow-lg p-3">
          <label className="text-xs font-semibold text-gray-600">Current Prefix:</label>
          <input
            type="text"
            value={selectedPrefix}
            onChange={(e) => setSelectedPrefix(e.target.value)}
            className="ml-2 px-2 py-1 border rounded text-sm"
            placeholder="e.g., auth, ui, data"
          />
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
        
        {showPreview && (
          <div className="mt-3 p-2 bg-gray-50 rounded border">
            <pre className="text-xs overflow-auto max-h-64">
              {JSON.stringify(exportToIR(nodes, connections), null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
          Nodes: {nodes.length} | Connections: {connections.length}
        </div>
      </div>
      
      {/* Connection Mode Indicator */}
      {connectingFrom && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-yellow-100 border-2 border-yellow-300 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">Connecting from: {connectingFrom}</span>
          <button onClick={() => setConnectingFrom(null)} className="ml-2 text-red-600 hover:text-red-800">Cancel</button>
        </div>
      )}
      
      {/* Controls Info */}
      <div className="absolute bottom-4 left-4 z-20 space-y-2">
        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <button onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">−</button>
          <span className="text-xs font-semibold text-gray-600">Zoom: {Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">+</button>
        </div>
        
        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg px-3 py-2 text-xs text-gray-600">
          <div>🖱️ <b>Scroll</b>: Zoom | <b>Shift+Drag</b>: Pan | <b>Drag Node</b>: Move</div>
          <div>🔗 <b>Right-click</b>: Connect nodes | <b>Click</b>: Select</div>
        </div>
      </div>
      
      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="relative w-full h-full" 
        style={{ 
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`, 
          transformOrigin: '0 0' 
        }}>
        {/* Group boundaries */}
        {Object.entries(groups).map(([prefix, groupNodes]) => {
          if (groupNodes.length < 2) return null
          const minX = Math.min(...groupNodes.map(n => n.x)) - 20
          const minY = Math.min(...groupNodes.map(n => n.y)) - 40
          const maxX = Math.max(...groupNodes.map(n => n.x)) + 200
          const maxY = Math.max(...groupNodes.map(n => n.y)) + 100
          
          return (
            <div
              key={prefix}
              className="absolute border-2 border-dashed border-gray-300 rounded-lg"
              style={{
                left: minX,
                top: minY,
                width: maxX - minX,
                height: maxY - minY,
                background: 'rgba(0,0,0,0.02)'
              }}
            >
              <div className="absolute -top-6 left-2 px-2 py-1 bg-white border rounded text-xs font-semibold text-gray-600">
                {prefix}
              </div>
            </div>
          )
        })}
        
        {/* Connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          {connections.map(conn => {
            const source = nodes.find(n => n.id === conn.source)
            const target = nodes.find(n => n.id === conn.target)
            if (!source || !target) return null
            
            return (
              <line
                key={conn.id}
                x1={source.x + 90}
                y1={source.y + 30}
                x2={target.x + 90}
                y2={target.y + 30}
                stroke="#999"
                strokeWidth="2"
              />
            )
          })}
        </svg>
        
        {/* Nodes */}
        {nodes.map(node => {
          const display = getNodeDisplay(node)
          const isSelected = selectedNode === node.id
          
          return (
            <div
              key={node.id}
              className={`absolute cursor-pointer ${
                node.type === 'cell' ? 'bg-blue-50 border-blue-300' : 'bg-green-50 border-green-300'
              } ${isSelected ? 'ring-2 ring-yellow-400' : ''} border-2 rounded-lg p-3`}
              style={{
                left: node.x,
                top: node.y,
                minWidth: display === 'dot' ? '20px' : display === 'compact' ? '120px' : '180px',
                minHeight: display === 'dot' ? '20px' : '60px'
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!isDraggingNode && !isPanning) {
                  handleNodeClick(node.id, e)
                }
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConnectingFrom(node.id)
              }}
            >
              {display !== 'dot' && (
                <>
                  <div className="text-xs font-semibold text-gray-600">{node.prefix}</div>
                  <div className="font-medium text-sm">{node.id.split('.').slice(1).join('.')}</div>
                  {display === 'full' && (
                    <div className="mt-1 text-xs text-gray-500">
                      {node.type === 'cell' ? `Merge: ${node.data.merge}` : `Fn: ${node.data.fn}`}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}