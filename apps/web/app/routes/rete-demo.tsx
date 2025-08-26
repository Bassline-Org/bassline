/**
 * Rete.js Demo - Visual editor for propagation networks
 * 
 * This demo shows:
 * - Visual node editor using Rete.js
 * - Creating and connecting cells
 * - Live propagation visualization
 * - Bidirectional sync with propagation network
 */

import { useState } from 'react'
import { Network } from 'proper-bassline/src/network'
import { OrdinalCell, MaxCell, MinCell } from 'proper-bassline/src/cells/basic'
import { ExtractValue } from 'proper-bassline/src/functions/extract'
import { ReteNetworkEditor } from 'proper-bassline-react/src/rete/ReteNetworkEditor'
import { num } from 'proper-bassline/src/types'

export default function ReteDemo() {
  const [network] = useState(() => {
    const net = new Network('demo')
    
    // Create some initial gadgets
    const input1 = new OrdinalCell('input1')
    const input2 = new OrdinalCell('input2')
    
    // Create extractors to convert OrdinalCell output to raw values
    const extract1 = new ExtractValue('extract1')
    const extract2 = new ExtractValue('extract2')
    
    const max = new MaxCell('max')
    const min = new MinCell('min')
    const output = new OrdinalCell('output')
    
    // Set initial values
    input1.userInput(num(5))
    input2.userInput(num(10))
    
    // Add to network
    net.add(input1, input2, extract1, extract2, max, min, output)
    
    // Wire them up - OrdinalCell -> ExtractValue -> Max/Min
    extract1.connectFrom('input', input1)
    extract2.connectFrom('input', input2)
    
    max.connectFrom(extract1)
    max.connectFrom(extract2)
    min.connectFrom(extract1)
    min.connectFrom(extract2)
    
    output.connectFrom(max)
    
    return net
  })
  
  const [showInstructions, setShowInstructions] = useState(true)
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Rete.js Propagation Network Editor</h1>
        <p className="text-gray-600 mt-1">
          Visual node editor for building and testing propagation networks
        </p>
      </div>
      
      {/* Instructions Panel */}
      {showInstructions && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-semibold text-blue-900 mb-2">How to use:</h2>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Click buttons in the palette to add new cells</li>
                <li>• Drag from output to input sockets to create connections</li>
                <li>• Right-click connections to remove them</li>
                <li>• Values propagate automatically through the network</li>
                <li>• Cells show their current values in real-time</li>
              </ul>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Editor */}
      <div className="flex-1 relative">
        <ReteNetworkEditor network={network} className="w-full h-full" />
      </div>
      
      {/* Status Bar */}
      <div className="bg-gray-100 border-t px-6 py-2">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Gadgets: {network.gadgets.size}</span>
          <span>•</span>
          <span>Ready</span>
        </div>
      </div>
    </div>
  )
}