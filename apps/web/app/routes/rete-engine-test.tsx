/**
 * Rete + BasslineEngine Test - Verifies the integration works
 */

import { useState } from 'react'
import { BasslineEngine } from 'proper-bassline/src/engine'
import { OrdinalCell, MaxCell } from 'proper-bassline/src/cells/basic'
import { AddFunction } from 'proper-bassline/src/functions/basic'
import { ExtractValue } from 'proper-bassline/src/functions/extract'
import { num } from 'proper-bassline/src/lattice-types'
import { ReteNetworkEditor } from 'proper-bassline-react/src/rete/ReteNetworkEditor'

export default function ReteEngineTest() {
  // Create the engine once
  const [engine] = useState(() => {
    const eng = new BasslineEngine('test-engine')
    
    // Add some initial gadgets to test with
    const cell1 = new OrdinalCell('input1')
    const cell2 = new OrdinalCell('input2')
    const extract1 = new ExtractValue('extract1')
    const extract2 = new ExtractValue('extract2')
    const adder = new AddFunction('adder')
    const maxCell = new MaxCell('max-result')
    
    // Add to engine
    eng.add(cell1, cell2, extract1, extract2, adder, maxCell)
    
    // Wire them up - OrdinalCell -> ExtractValue -> AddFunction
    extract1.connectFrom('input', cell1)
    extract2.connectFrom('input', cell2)
    adder.connectFrom('a', extract1)
    adder.connectFrom('b', extract2)
    maxCell.connectFrom(adder)
    
    // Set initial values
    cell1.userInput(num(5))
    cell2.userInput(num(10))
    
    // Subscribe to events for debugging
    eng.subscribe(event => {
      console.log('[Engine Event]', event.type, event)
    })
    
    return eng
  })
  
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Rete + BasslineEngine Test</h1>
        <p className="text-gray-600">
          Testing propagation network with Rete.js visualization
        </p>
      </div>
      
      <ReteNetworkEditor 
        engine={engine}
        className="flex-1"
      />
    </div>
  )
}