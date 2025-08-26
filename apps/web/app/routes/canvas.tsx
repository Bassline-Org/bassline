/**
 * Infinite Canvas with Semantic Zoom
 * 
 * The main editor interface where everything is a gadget on an infinite canvas.
 * Semantic zoom reveals different levels of detail as you zoom in/out.
 */

import { useMemo } from 'react'
import { ViewportGadget } from 'proper-bassline/src/gadgets/viewport'
import { RectGadget } from 'proper-bassline/src/visuals/rect'
import { TextGadget } from 'proper-bassline/src/visuals/text'
import { useNetwork, useGadget, NetworkProvider } from 'proper-bassline-react/src/hooks'
import { KonvaNetworkCanvas } from 'proper-bassline-react/src/konva/KonvaNetworkCanvas'

function CanvasContent() {
  const network = useNetwork()
  
  // Create viewport gadget
  const viewport = useGadget(() => {
    const v = new ViewportGadget('main-viewport')
    network.add(v)
    return v
  }, 'main-viewport')
  
  // Create visual gadgets for testing - only once!
  useMemo(() => {
    // Check if already created
    const existing = network.getByPath('test-rect1')
    if (existing) return
    
    // Create some rectangles
    const rect1 = new RectGadget('test-rect1')
    rect1.setPosition(100, 100)
    rect1.setSize(150, 80)
    rect1.setBackgroundColor('#3b82f6')
    rect1.setBorderRadius(8)
    
    const rect2 = new RectGadget('test-rect2')
    rect2.setPosition(300, 100)
    rect2.setSize(150, 80)
    rect2.setBackgroundColor('#10b981')
    rect2.setBorderRadius(8)
    
    // Create some text labels
    const text1 = new TextGadget('test-text1')
    text1.setPosition(120, 130)
    text1.setText('Input A')
    text1.setFontSize(16)
    text1.setColor('#ffffff')
    
    const text2 = new TextGadget('test-text2')
    text2.setPosition(320, 130)
    text2.setText('Input B')
    text2.setFontSize(16)
    text2.setColor('#ffffff')
    
    // Add to network
    network.add(rect1, rect2, text1, text2)
  }, [network])
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50 relative">
      {/* Konva Canvas */}
      <KonvaNetworkCanvas viewport={viewport} />
      
      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg">
        <div className="flex items-center justify-between p-4">
          {/* Gadget Palette */}
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
              + Rect
            </button>
            <button className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
              + Text
            </button>
            <button className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600">
              + Group
            </button>
          </div>
          
          {/* View Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => viewport.zoomOut()}
              className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Zoom Out
            </button>
            <button
              onClick={() => viewport.resetView()}
              className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Reset
            </button>
            <button
              onClick={() => viewport.zoomIn()}
              className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Zoom In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Canvas() {
  return (
    <NetworkProvider>
      <CanvasContent />
    </NetworkProvider>
  )
}