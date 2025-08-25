/**
 * Inspector Demo - Shows live property inspection of gadgets
 */

import { useState, useCallback } from 'react'
import { NetworkProvider, useNetwork, useGadget } from '../../../../proper-bassline-react/src/hooks'
import { InspectorViewComponent } from '../../../../proper-bassline-react/src/inspector-view'
import { GraphViewComponent } from '../../../../proper-bassline-react/src/graph-view'
import { Network } from '../../../../proper-bassline/src/network'
import { OrdinalCell, MaxCell, SetCell } from '../../../../proper-bassline/src/cells/basic'
import { AddFunction, MultiplyFunction } from '../../../../proper-bassline/src/functions/basic'
import { str, num } from '../../../../proper-bassline/src/types'
import type { Gadget } from '../../../../proper-bassline/src/gadget'

function InspectorDemoContent() {
  const network = useNetwork()
  const [selectedGadget, setSelectedGadget] = useState<Gadget | null>(null)
  
  // Create some gadgets to inspect
  const cell1 = useGadget(() => {
    const cell = new OrdinalCell('input-1')
    cell.userInput(num(10))
    network.add(cell)
    return cell
  })
  
  const cell2 = useGadget(() => {
    const cell = new OrdinalCell('input-2')
    cell.userInput(num(20))
    network.add(cell)
    return cell
  })
  
  const cell3 = useGadget(() => {
    const cell = new MaxCell('max-cell')
    network.add(cell)
    return cell
  })
  
  const addGadget = useGadget(() => {
    const gadget = new AddFunction('adder')
    gadget.connectFrom('a', cell1)
    gadget.connectFrom('b', cell2)
    network.add(gadget)
    return gadget
  })
  
  const multiplyGadget = useGadget(() => {
    const gadget = new MultiplyFunction('multiplier')
    gadget.connectFrom('a', addGadget)
    gadget.connectFrom('b', cell3)
    network.add(gadget)
    return gadget
  })
  
  // Connect cell3 to get some values
  useGadget(() => {
    cell3.connectFrom(cell1)
    cell3.connectFrom(cell2)
    return null
  })
  
  const handleGadgetSelect = useCallback((gadgetId: string) => {
    // Find the gadget in the network
    for (const gadget of network.gadgets) {
      if (gadget.id === gadgetId) {
        setSelectedGadget(gadget)
        break
      }
    }
  }, [network])
  
  const handlePropertyChange = useCallback((gadgetId: string, property: string, value: any) => {
    console.log('Property change:', gadgetId, property, value)
    // Would implement actual property updates here
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Inspector View Demo</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Network Structure</h3>
        <ul className="text-sm space-y-1">
          <li>• Two input cells (OrdinalCell) with values 10 and 20</li>
          <li>• A MaxCell that receives both inputs</li>
          <li>• An AddGadget that adds the two inputs</li>
          <li>• A MultiplyGadget that multiplies the sum by the max</li>
        </ul>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Graph View */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Network Graph</h2>
          <p className="text-gray-600 mb-4">
            Click on a node to inspect it
          </p>
          <GraphViewComponent 
            network={network}
            width={500}
            height={400}
            nodeSpacing={100}
            className="shadow-lg"
          />
          
          {/* Gadget selection buttons */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">Quick Select:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGadget(cell1)}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
              >
                input-1
              </button>
              <button
                onClick={() => setSelectedGadget(cell2)}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
              >
                input-2
              </button>
              <button
                onClick={() => setSelectedGadget(cell3)}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
              >
                max-cell
              </button>
              <button
                onClick={() => setSelectedGadget(addGadget)}
                className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 rounded"
              >
                adder
              </button>
              <button
                onClick={() => setSelectedGadget(multiplyGadget)}
                className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 rounded"
              >
                multiplier
              </button>
              <button
                onClick={() => setSelectedGadget(null)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        
        {/* Inspector View */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Inspector</h2>
          <p className="text-gray-600 mb-4">
            {selectedGadget ? `Inspecting: ${selectedGadget.id}` : 'Select a gadget to inspect'}
          </p>
          <InspectorViewComponent
            target={selectedGadget}
            width={450}
            height={500}
            onPropertyChange={handlePropertyChange}
            className="shadow-lg"
          />
        </div>
      </div>
      
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">What's Happening?</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              The <strong>GraphView</strong> visualizes the network structure with nodes and edges
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              The <strong>InspectorView</strong> shows detailed properties of the selected gadget
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Properties include inputs, outputs, connections, and downstream gadgets
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Both views are <strong>FunctionGadgets</strong> that compute their visual output
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default function InspectorDemo() {
  return (
    <NetworkProvider>
      <InspectorDemoContent />
    </NetworkProvider>
  )
}