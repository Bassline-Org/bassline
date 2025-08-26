/**
 * Rete Builder - Interactive propagation network builder
 * 
 * This demo allows you to:
 * - Create cells and functions visually
 * - Connect them to build networks
 * - See values propagate in real-time
 * - Edit cell values directly
 */

import { useState } from 'react'
import { Network } from 'proper-bassline/src/network'
import { OrdinalCell, MaxCell, MinCell } from 'proper-bassline/src/cells/basic'
import { ExtractValue } from 'proper-bassline/src/functions/extract'
import { FunctionGadget } from 'proper-bassline/src/function'
import { num, str, prettyPrint } from 'proper-bassline/src/types'
import type { LatticeValue } from 'proper-bassline/src/types'
import { ReteNetworkEditor } from 'proper-bassline-react/src/rete/ReteNetworkEditor'

// Simple Add function for demo
class AddFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['a', 'b'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const a = args['a']
    const b = args['b']
    
    if (!a || !b) return { type: 'nil', value: null }
    if (a.type !== 'number' || b.type !== 'number') {
      return { type: 'nil', value: null }
    }
    
    return num(a.value + b.value)
  }
}

// Multiply function
class MultiplyFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['a', 'b'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const a = args['a']
    const b = args['b']
    
    if (!a || !b) return { type: 'nil', value: null }
    if (a.type !== 'number' || b.type !== 'number') {
      return { type: 'nil', value: null }
    }
    
    return num(a.value * b.value)
  }
}

export default function ReteBuilder() {
  const [network] = useState(() => {
    const net = new Network('builder')
    
    // Add some initial gadgets to demonstrate
    const input1 = new OrdinalCell('input1')
    const input2 = new OrdinalCell('input2')
    
    // Extractors to get raw values from OrdinalCells
    const extract1 = new ExtractValue('extract1')
    const extract2 = new ExtractValue('extract2')
    
    const adder = new AddFunction('adder')
    const multiplier = new MultiplyFunction('multiplier')
    const output = new MaxCell('output')
    
    // Set some initial values
    input1.userInput(num(3))
    input2.userInput(num(7))
    
    // Add to network
    net.add(input1, input2, extract1, extract2, adder, multiplier, output)
    
    // Wire them up - OrdinalCell -> ExtractValue -> Functions
    extract1.connectFrom('input', input1)
    extract2.connectFrom('input', input2)
    
    adder.connectFrom('a', extract1)
    adder.connectFrom('b', extract2)
    multiplier.connectFrom('a', extract1)
    multiplier.connectFrom('b', extract2)
    
    output.connectFrom(adder)
    output.connectFrom(multiplier)
    
    return net
  })
  
  const [selectedGadget, setSelectedGadget] = useState<string | null>(null)
  
  // Get current values for display
  const gadgets = Array.from(network.gadgets)
  const values: Record<string, string> = {}
  gadgets.forEach(g => {
    const output = g.getOutput()
    values[g.id] = prettyPrint(output)
  })
  
  return (
    <div className="h-screen flex">
      {/* Left Panel - Network Info */}
      <div className="w-80 bg-white border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Network Inspector</h2>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Gadgets ({gadgets.length})</h3>
            <div className="space-y-2">
              {gadgets.map(gadget => (
                <div
                  key={gadget.id}
                  className={`p-2 border rounded cursor-pointer transition-colors ${
                    selectedGadget === gadget.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedGadget(gadget.id)}
                >
                  <div className="font-medium">{gadget.id}</div>
                  <div className="text-sm text-gray-600">
                    Type: {gadget.constructor.name}
                  </div>
                  <div className="text-sm">
                    Value: <span className="font-mono">{values[gadget.id]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {selectedGadget && (
            <div>
              <h3 className="font-semibold mb-2">Selected: {selectedGadget}</h3>
              <div className="p-3 bg-gray-50 rounded text-sm">
                <div>Type: {gadgets.find(g => g.id === selectedGadget)?.constructor.name}</div>
                <div>Value: {values[selectedGadget]}</div>
                {gadgets.find(g => g.id === selectedGadget) instanceof OrdinalCell && (
                  <div className="mt-2">
                    <input
                      type="number"
                      className="w-full px-2 py-1 border rounded"
                      placeholder="Enter new value"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const gadget = network.getByPath(selectedGadget) as OrdinalCell
                          if (gadget) {
                            const value = parseFloat((e.target as HTMLInputElement).value)
                            if (!isNaN(value)) {
                              gadget.userInput(num(value))
                              // Force re-render
                              setSelectedGadget(selectedGadget)
                            }
                          }
                        }
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">Press Enter to update</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Canvas */}
      <div className="flex-1 bg-gray-50">
        <ReteNetworkEditor network={network} className="w-full h-full" />
      </div>
    </div>
  )
}