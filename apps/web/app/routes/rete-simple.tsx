/**
 * Simple Rete.js Test - Minimal setup to verify Rete integration works
 */

import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Network } from 'proper-bassline/src/network'
import { OrdinalCell } from 'proper-bassline/src/cells/basic'
import { num } from 'proper-bassline/src/types'

// Import Rete components directly
import { NodeEditor, ClassicPreset as Classic } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { ReactPlugin, Presets as ReactPresets } from 'rete-react-plugin'

// Simple node class
class NumberNode extends Classic.Node {
  constructor(value: number = 0) {
    super('Number')
    this.addOutput('value', new Classic.Output(new Classic.Socket('number')))
    this.addControl('value', new Classic.InputControl('number', { initial: value }))
  }
}

type Nodes = NumberNode
type Connections = Classic.Connection<NumberNode, NumberNode>
type Schemes = Classic.GetSchemes<Nodes, Connections>

export default function ReteSimple() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Initializing...')
  
  useEffect(() => {
    if (!containerRef.current) return
    
    const setup = async () => {
      try {
        setStatus('Creating editor...')
        const container = containerRef.current!
        
        // Create basic Rete editor
        const editor = new NodeEditor<Schemes>()
        const area = new AreaPlugin<Schemes, any>(container)
        const connection = new ConnectionPlugin<Schemes>()
        const render = new ReactPlugin<Schemes>({ createRoot })
        
        // Setup rendering
        render.addPreset(ReactPresets.classic.setup())
        
        // Setup connections
        connection.addPreset(ConnectionPresets.classic.setup())
        
        // Register plugins
        editor.use(area)
        area.use(connection)
        area.use(render)
        
        setStatus('Adding nodes...')
        
        // Add some test nodes
        const node1 = new NumberNode(5)
        const node2 = new NumberNode(10)
        const node3 = new NumberNode(0)
        
        await editor.addNode(node1)
        await editor.addNode(node2)
        await editor.addNode(node3)
        
        // Position nodes
        await area.translate(node1.id, { x: 100, y: 100 })
        await area.translate(node2.id, { x: 100, y: 250 })
        await area.translate(node3.id, { x: 400, y: 175 })
        
        // Create connections
        await editor.addConnection(new Classic.Connection(node1, 'value', node3, 'value'))
        await editor.addConnection(new Classic.Connection(node2, 'value', node3, 'value'))
        
        setStatus('Ready!')
      } catch (error) {
        setStatus(`Error: ${error}`)
        console.error('Rete setup error:', error)
      }
    }
    
    setup()
  }, [])
  
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Simple Rete.js Test</h1>
        <p className="text-gray-600">Status: {status}</p>
      </div>
      
      <div
        ref={containerRef}
        className="flex-1 bg-gray-50"
        style={{ position: 'relative' }}
      />
    </div>
  )
}