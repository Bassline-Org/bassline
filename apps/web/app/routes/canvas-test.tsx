/**
 * Canvas Test Route - Complete Bidirectional Integration
 * 
 * This demonstrates the completed "Canvas system using gadgets":
 * 1. Creating gadgets via React components
 * 2. Rendering existing gadgets from network
 * 3. Affordances wiring to cells
 * 4. Network queries driving visual layouts
 */

import { useMemo } from 'react'
import { 
  NetworkProvider,
  RectGadgetComponent,
  TextGadgetComponent,
  GroupGadgetComponent,
  TapAffordanceComponent,
  DragAffordanceComponent,
  HoverAffordanceComponent,
  Interactive,
  NetworkCanvas,
  ViewCanvas,
  InteractiveCanvas,
  useNetwork,
  useGadget,
  useCell
} from '../../../../proper-bassline-react/src/index'
import { Network } from '../../../../proper-bassline/src/network'
import { OrdinalCell } from '../../../../proper-bassline/src/cells/basic'
import { RectGadget, TextGadget } from '../../../../proper-bassline/src/visuals'
import { bool, num, str, dict } from '../../../../proper-bassline/src/types'

// ============================================================================
// Test 1: React → Network (Components create gadgets)
// ============================================================================

function ReactToNetworkDemo() {
  const network = useNetwork()
  
  // Create cells for state that can be wired!
  const clickCountCell = useGadget(() => {
    const cell = new OrdinalCell('click-count')
    cell.userInput(num(0))
    return cell
  }, 'click-count')
  
  const dragPositionCell = useGadget(() => {
    const cell = new OrdinalCell('drag-position')
    cell.userInput(dict({ x: num(200), y: num(50) }))
    return cell
  }, 'drag-position')
  
  // Subscribe to cells
  const [clickCount] = useCell(clickCountCell)
  const [dragPosition] = useCell(dragPositionCell)
  
  console.log('Drag position from cell:', dragPosition)
  
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Test 1: React Components → Network</h2>
      <p className="text-sm text-gray-600 mb-4">
        These React components create actual gadgets in the propagation network
      </p>
      
      <div className="relative border border-gray-300 bg-gray-50" style={{ width: '500px', height: '200px' }}>
        
        {/* Clickable button that creates gadgets */}
        <RectGadgetComponent
          id="react-button"
          position={{ x: 20, y: 30 }}
          size={{ width: 140, height: 50 }}
          color="#3b82f6"
          borderRadius={8}
        >
          <TapAffordanceComponent
            id="react-tap"
            onTap={() => {
              // Increment using the cell
              const current = clickCountCell.getOutput()
              const val = current?.value?.get?.('value')?.value || 0
              clickCountCell.userInput(num(val + 1))
            }}
          >
            <TextGadgetComponent
              id="button-label"
              position={{ x: 15, y: 15 }}
              text={`Clicks: ${clickCount}`}
              color="white"
              fontSize={14}
              fontWeight="bold"
            />
          </TapAffordanceComponent>
        </RectGadgetComponent>
        
        {/* Draggable element */}
        <DragAffordanceComponent 
          id="drag-demo"
          onDrag={(pos) => {
            console.log('Drag event:', pos)
            // Update position using the cell
            const newPos = dict({ 
              x: num(pos.x - 40), 
              y: num(pos.y - 20) 
            })
            console.log('Setting drag position to:', newPos)
            dragPositionCell.userInput(newPos)
          }}
        >
          <RectGadgetComponent
            id="draggable"
            position={{ x: dragPosition?.x || 200, y: dragPosition?.y || 50 }}
            size={{ width: 80, height: 40 }}
            color="#10b981"
            borderRadius={6}
          >
            <TextGadgetComponent
              id="drag-label"
              position={{ x: 15, y: 12 }}
              text="Drag me"
              color="white"
              fontSize={12}
            />
          </RectGadgetComponent>
        </DragAffordanceComponent>
        
        {/* Hover-reactive element */}
        <HoverAffordanceComponent id="hover-demo">
          <RectGadgetComponent
            id="hoverable"
            position={{ x: 350, y: 30 }}
            size={{ width: 120, height: 50 }}
            color="#8b5cf6"
            borderRadius={8}
          >
            <TextGadgetComponent
              id="hover-label"
              position={{ x: 25, y: 15 }}
              text="Hover me"
              color="white"
              fontSize={14}
            />
          </RectGadgetComponent>
        </HoverAffordanceComponent>
        
      </div>
    </div>
  )
}

// ============================================================================
// Test 2: Network → React (Render existing gadgets)
// ============================================================================

function NetworkToReactDemo() {
  // Create network with gadgets programmatically
  const network = useMemo(() => {
    const net = new Network('demo-network')
    
    // Create visual gadgets directly in the network (not via React)
    const rect1 = new RectGadget('net-rect1')
    rect1.setPosition(30, 30).setSize(120, 60).setBackgroundColor('#3b82f6')
    
    const text1 = new TextGadget('net-text1')
    text1.setPosition(45, 50).setText('From Network API').setColor('#ffffff')
    
    const rect2 = new RectGadget('net-rect2')
    rect2.setPosition(180, 30).setSize(120, 60).setBackgroundColor('#10b981')
    
    const text2 = new TextGadget('net-text2')
    text2.setPosition(195, 50).setText('Also Network API').setColor('#ffffff')
    
    const rect3 = new RectGadget('net-rect3')
    rect3.setPosition(330, 30).setSize(120, 60).setBackgroundColor('#8b5cf6')
    
    const text3 = new TextGadget('net-text3')
    text3.setPosition(345, 50).setText('Pure Gadgets!').setColor('#ffffff')
    
    // Add to network
    net.add(rect1, text1, rect2, text2, rect3, text3)
    
    console.log('NetworkToReactDemo created network with gadgets:', {
      total: net.gadgets.size,
      rects: [rect1.id, rect2.id, rect3.id],
      texts: [text1.id, text2.id, text3.id]
    })
    
    return net
  }, [])
  
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Test 2: Network → React Components</h2>
      <p className="text-sm text-gray-600 mb-4">
        NetworkCanvas automatically renders all VisualGadgets from the network
      </p>
      
      <NetworkCanvas 
        network={network}
        width={500}
        height={150}
        style={{ backgroundColor: '#f8fafc', borderRadius: '8px' }}
        className="border border-gray-300"
      />
    </div>
  )
}

// ============================================================================
// Test 3: ViewCanvas with Query System
// ============================================================================

function ViewCanvasDemo() {
  const network = useMemo(() => {
    const net = new Network('view-demo')
    
    // Create many gadgets for layout testing
    for (let i = 0; i < 8; i++) {
      const rect = new RectGadget(`view-rect-${i}`)
      rect.setSize(70, 50)
      rect.setMetadata('type', 'shape')
      rect.setMetadata('category', i % 2 === 0 ? 'even' : 'odd')
      net.add(rect)
      
      const text = new TextGadget(`view-text-${i}`)
      text.setText(`Item ${i}`)
      text.setMetadata('type', 'label')
      net.add(text)
    }
    
    return net
  }, [])
  
  // Use cells for state
  const layoutCell = useGadget(() => {
    const cell = new OrdinalCell('view-layout')
    cell.userInput(str('grid'))
    return cell
  }, 'view-layout')
  
  const selectorCell = useGadget(() => {
    const cell = new OrdinalCell('view-selector')
    cell.userInput(str('RectGadget'))
    return cell
  }, 'view-selector')
  
  const [layout] = useCell(layoutCell)
  const [selector] = useCell(selectorCell)
  
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Test 3: ViewCanvas with Query System</h2>
      <p className="text-sm text-gray-600 mb-4">
        Uses QueryGadget + ProjectionGadget to dynamically layout query results
      </p>
      
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Query Selector:</label>
          <select 
            value={selector || 'RectGadget'} 
            onChange={(e) => selectorCell.userInput(str(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="RectGadget">All Rectangles</option>
            <option value="TextGadget">All Text</option>
            <option value='[category="even"]'>Even Items Only</option>
            <option value="*">Everything</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Layout:</label>
          <select 
            value={layout || 'grid'} 
            onChange={(e) => layoutCell.userInput(str(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="list">List</option>
            <option value="grid">Grid</option>
            <option value="tree">Tree</option>
          </select>
        </div>
      </div>
      
      <ViewCanvas
        network={network}
        selector={selector}
        layout={layout}
        layoutParams={{
          columns: 4,
          spacing: 15,
          cellWidth: 90,
          cellHeight: 60
        }}
        width={500}
        height={300}
        style={{ backgroundColor: '#f1f5f9', borderRadius: '8px' }}
        className="border border-gray-300"
      />
    </div>
  )
}

// ============================================================================
// Test 4: Interactive Canvas
// ============================================================================

function InteractiveCanvasDemo() {
  const network = useMemo(() => {
    const net = new Network('interactive-demo')
    
    const rect1 = new RectGadget('interactive-rect1')
    rect1.setPosition(50, 50).setSize(100, 60)
    
    const text1 = new TextGadget('interactive-text1')
    text1.setPosition(70, 70).setText('Interactive')
    
    const rect2 = new RectGadget('interactive-rect2')
    rect2.setPosition(200, 80).setSize(80, 40)
    
    const text2 = new TextGadget('interactive-text2')
    text2.setPosition(220, 95).setText('Canvas')
    
    net.add(rect1, text1, rect2, text2)
    
    return net
  }, [])
  
  // Use cells for interaction state
  const lastClickCell = useGadget(() => {
    const cell = new OrdinalCell('last-click')
    cell.userInput(dict({ x: num(0), y: num(0) }))
    return cell
  }, 'last-click')
  
  const dragInfoCell = useGadget(() => {
    const cell = new OrdinalCell('drag-info')
    cell.userInput(str(''))
    return cell
  }, 'drag-info')
  
  const [lastClick] = useCell(lastClickCell)
  const [dragInfo] = useCell(dragInfoCell)
  
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Test 4: Interactive Canvas</h2>
      <p className="text-sm text-gray-600 mb-2">
        Click and drag on the canvas. Events are handled by the canvas itself.
      </p>
      
      <div className="text-sm text-gray-700 mb-4">
        <div>Last click: ({lastClick?.x?.toFixed?.(0) || 0}, {lastClick?.y?.toFixed?.(0) || 0})</div>
        <div>{dragInfo}</div>
      </div>
      
      <InteractiveCanvas
        network={network}
        width={500}
        height={200}
        onCanvasClick={(pos) => lastClickCell.userInput(dict({ x: num(pos.x), y: num(pos.y) }))}
        onCanvasDrag={(start, end) => {
          dragInfoCell.userInput(str(`Dragged from (${start.x.toFixed(0)}, ${start.y.toFixed(0)}) to (${end.x.toFixed(0)}, ${end.y.toFixed(0)})`))
        }}
        style={{ backgroundColor: '#fef3c7', borderRadius: '8px' }}
        className="border border-gray-300"
      />
    </div>
  )
}

// ============================================================================
// Test 5: Combined Bidirectional Demo
// ============================================================================

function CombinedDemoContent({ network }: { network: Network }) {
  // Use cells for interaction state - now inside the NetworkProvider
  const hoverCell = useGadget(() => {
    const cell = new OrdinalCell('hover-state')
    cell.userInput(bool(false))
    return cell
  }, 'hover-state')
  
  const clickCountCell = useGadget(() => {
    const cell = new OrdinalCell('combined-clicks')
    cell.userInput(num(0))
    return cell
  }, 'combined-clicks')
  
  const [hovering] = useCell(hoverCell)
  const [clickCount] = useCell(clickCountCell)
  
  // Debug: log what's in the network
  console.log('CombinedDemo network gadgets:', network.gadgets.size, Array.from(network.gadgets).map(g => g.id))
  
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Test 5: Complete Bidirectional Integration</h2>
      <p className="text-sm text-gray-600 mb-4">
        Left: React creates gadgets. Right: Canvas renders all gadgets from the same network.
      </p>
      
      <div className="flex gap-6">
        {/* Left side: Create gadgets with React */}
        <div className="flex-1">
          <h3 className="font-medium mb-2">React Creates Gadgets</h3>
          <div className="relative border border-gray-300 bg-gray-50 rounded" style={{ width: '220px', height: '150px' }}>
            <Interactive
              tap={{ 
                id: 'combined-tap',
                onTap: () => {
                  const current = clickCountCell.getOutput()
                  const val = current?.value?.get?.('value')?.value || 0
                  clickCountCell.userInput(num(val + 1))
                }
              }}
              hover={{ 
                id: 'combined-hover',
                onHover: (isHovering) => {
                  hoverCell.userInput(bool(isHovering))
                }
              }}
            >
              <RectGadgetComponent
                id="combined-button"
                position={{ x: 20, y: 30 }}
                size={{ width: 180, height: 60 }}
                color={hovering ? "#4f46e5" : "#6366f1"}
                borderRadius={8}
              >
                <TextGadgetComponent
                  id="combined-label"
                  position={{ x: 40, y: 20 }}
                  text={hovering ? `Hovering! (${clickCount} clicks)` : `Click me! (${clickCount})`}
                  color="white"
                  fontSize={14}
                />
              </RectGadgetComponent>
            </Interactive>
          </div>
        </div>
        
        {/* Right side: Render all gadgets from the same network */}
        <div className="flex-1">
          <h3 className="font-medium mb-2">Network Renders Everything</h3>
          <NetworkCanvas 
            network={network}
            width={220}
            height={150}
            style={{ backgroundColor: '#f9fafb', borderRadius: '6px' }}
            className="border border-gray-300"
          />
        </div>
      </div>
    </div>
  )
}

function CombinedDemo() {
  const network = useMemo(() => new Network('combined-demo'), [])
  
  return (
    <NetworkProvider network={network}>
      <CombinedDemoContent network={network} />
    </NetworkProvider>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function CanvasTest() {
  const mainNetwork = new Network('main')
  
  return (
    <NetworkProvider network={mainNetwork}>
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              🎨 Canvas System Test
            </h1>
            <p className="text-lg text-gray-600">
              Complete bidirectional integration: React ↔ Propagation Network
            </p>
          </div>
          
          <div className="space-y-8">
            <ReactToNetworkDemo />
            <NetworkToReactDemo />
            <ViewCanvasDemo />
            <InteractiveCanvasDemo />
            <CombinedDemo />
            
            {/* System Summary */}
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">
                ✨ System Capabilities Demonstrated
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    React components create gadgets in network
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    NetworkCanvas renders gadgets from network
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    Affordances wire to cells via readers/writers
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    ViewCanvas uses query system for layouts
                  </li>
                </ul>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    Interactive canvas handles user input
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    Bidirectional: React ↔ Network seamlessly
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    Visual properties as cells (position, size, etc.)
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <strong>The UI IS the computational graph!</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </NetworkProvider>
  )
}