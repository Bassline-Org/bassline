/**
 * Test page to verify ViewportGadget is working correctly
 */

import { useState } from 'react'
import { ViewportGadget } from 'proper-bassline/src/gadgets/viewport'
import { useCell, NetworkProvider, useNetwork } from 'proper-bassline-react/src/hooks'

function ViewportTest() {
  const network = useNetwork()
  const [viewport] = useState(() => {
    const v = new ViewportGadget('test-viewport')
    network.add(v)
    return v
  })
  
  // Subscribe to viewport cells
  const [pan] = useCell(viewport.pan)
  const [zoom] = useCell(viewport.zoom)
  const [showGrid] = useCell(viewport.showGrid)
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Viewport Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Current Values:</h2>
          <div>Pan: {JSON.stringify(pan)}</div>
          <div>Zoom: {zoom}</div>
          <div>Grid: {showGrid ? 'On' : 'Off'}</div>
        </div>
        
        <div className="space-x-2">
          <button 
            onClick={() => viewport.setPan(100, 50)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Set Pan (100, 50)
          </button>
          <button 
            onClick={() => viewport.setZoom(2)}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Set Zoom 2x
          </button>
          <button 
            onClick={() => viewport.zoomIn()}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
            Zoom In
          </button>
          <button 
            onClick={() => viewport.zoomOut()}
            className="px-4 py-2 bg-orange-500 text-white rounded"
          >
            Zoom Out
          </button>
          <button 
            onClick={() => viewport.resetView()}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TestViewport() {
  return (
    <NetworkProvider>
      <ViewportTest />
    </NetworkProvider>
  )
}