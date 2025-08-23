/**
 * Constraint Demo - Shows off the real power of propagation networks
 * - Bidirectional constraints
 * - Multiple writers to same cell
 * - Natural cycle handling
 * - Live propagation visualization
 */

import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Network } from './src/network'
import { NetworkProvider, useGadget, useCell, useFunctionOutput, useNetwork } from './src/react-integration'
import { MaxCell, MinCell, OrCell, UnionCell } from './src/cells/basic'
import { AddFunction, MultiplyFunction } from './src/functions/basic'
import { Cell } from './src/cell'
import { FunctionGadget } from './src/function'
import { num, bool, set, nil, isNumber, LatticeValue } from './src/types'

// ============================================================================
// Temperature Converter - Bidirectional Constraints
// ============================================================================

// Custom cell that maintains temperature with conversions
class TemperatureCell extends Cell {
  latticeOp(...values: LatticeValue[]): LatticeValue {
    // Take the maximum temperature
    const temps = values.filter(isNumber)
    if (temps.length === 0) return nil()
    return num(Math.max(...temps.map(t => t.value)))
  }
}

// Celsius to Fahrenheit function
class CelsiusToFahrenheit extends FunctionGadget {
  constructor(id: string) {
    super(id, ['celsius'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const c = args.celsius
    if (!isNumber(c)) return nil()
    return num(c.value * 9/5 + 32)
  }
}

// Fahrenheit to Celsius function
class FahrenheitToCelsius extends FunctionGadget {
  constructor(id: string) {
    super(id, ['fahrenheit'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const f = args.fahrenheit
    if (!isNumber(f)) return nil()
    return num((f.value - 32) * 5/9)
  }
}

function TemperatureConverter() {
  const celsius = useGadget(() => new TemperatureCell('celsius'))
  const fahrenheit = useGadget(() => new TemperatureCell('fahrenheit'))
  const c2f = useGadget(() => new CelsiusToFahrenheit('c2f').connect({ celsius }))
  const f2c = useGadget(() => new FahrenheitToCelsius('f2c').connect({ fahrenheit }))
  
  // Create the bidirectional constraint!
  useEffect(() => {
    // Fahrenheit cell also listens to the C->F converter
    fahrenheit.from(c2f)
    // Celsius cell also listens to the F->C converter
    celsius.from(f2c)
  }, [])
  
  const [celsiusValue, setCelsius] = useCell(celsius)
  const [fahrenheitValue, setFahrenheit] = useCell(fahrenheit)
  const network = useNetwork()
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold mb-4">Bidirectional Temperature Converter</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Celsius</label>
          <input
            type="number"
            value={isNumber(celsiusValue) ? celsiusValue.value : 0}
            onChange={(e) => {
              setCelsius(num(parseFloat(e.target.value) || 0))
              network.propagate()
            }}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Fahrenheit</label>
          <input
            type="number"
            value={isNumber(fahrenheitValue) ? fahrenheitValue.value : 0}
            onChange={(e) => {
              setFahrenheit(num(parseFloat(e.target.value) || 0))
              network.propagate()
            }}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Change either value - the other updates automatically!
        This is a true bidirectional constraint with a cycle.
      </p>
    </div>
  )
}

// ============================================================================
// Multiple Writers Demo - Shows lattice operations
// ============================================================================

function MultipleWritersDemo() {
  const maxCell = useGadget(() => new MaxCell('max-aggregator'))
  const minCell = useGadget(() => new MinCell('min-aggregator'))
  const orCell = useGadget(() => new OrCell('or-aggregator'))
  
  // Create multiple source cells
  const source1 = useGadget(() => new MaxCell('source1'))
  const source2 = useGadget(() => new MaxCell('source2'))
  const source3 = useGadget(() => new MaxCell('source3'))
  
  // Wire them all to the aggregators
  useEffect(() => {
    maxCell.from(source1, source2, source3)
    minCell.from(source1, source2, source3)
  }, [])
  
  const [val1, setVal1] = useCell(source1)
  const [val2, setVal2] = useCell(source2)
  const [val3, setVal3] = useCell(source3)
  const [maxValue] = useCell(maxCell)
  const [minValue] = useCell(minCell)
  
  const network = useNetwork()
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold mb-4">Multiple Writers (Lattice Operations)</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm w-20">Source 1:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={isNumber(val1) ? val1.value : 0}
            onChange={(e) => {
              setVal1(num(parseInt(e.target.value)))
              network.propagate()
            }}
            className="flex-1"
          />
          <span className="w-12 text-sm">{isNumber(val1) ? val1.value : 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm w-20">Source 2:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={isNumber(val2) ? val2.value : 0}
            onChange={(e) => {
              setVal2(num(parseInt(e.target.value)))
              network.propagate()
            }}
            className="flex-1"
          />
          <span className="w-12 text-sm">{isNumber(val2) ? val2.value : 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm w-20">Source 3:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={isNumber(val3) ? val3.value : 0}
            onChange={(e) => {
              setVal3(num(parseInt(e.target.value)))
              network.propagate()
            }}
            className="flex-1"
          />
          <span className="w-12 text-sm">{isNumber(val3) ? val3.value : 0}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t space-y-1">
        <div className="flex justify-between">
          <span className="font-medium">Max (lattice join):</span>
          <span className="font-mono">{isNumber(maxValue) ? maxValue.value : 'nil'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Min (lattice meet):</span>
          <span className="font-mono">{isNumber(minValue) ? minValue.value : 'nil'}</span>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-3">
        Multiple cells write to the same aggregators.
        The lattice operations (max/min) handle merging automatically.
      </p>
    </div>
  )
}

// ============================================================================
// Network Visualizer - See the live network
// ============================================================================

function NetworkVisualizer() {
  const network = useNetwork()
  const [, forceUpdate] = useState({})
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 100)
    return () => clearInterval(interval)
  }, [])
  
  // Group gadgets by type
  const cells: Cell[] = []
  const functions: FunctionGadget[] = []
  const networks: Network[] = []
  
  for (const gadget of network.gadgets) {
    if (gadget instanceof Network) {
      networks.push(gadget)
    } else if (gadget instanceof Cell) {
      cells.push(gadget)
    } else if (gadget instanceof FunctionGadget) {
      functions.push(gadget)
    }
  }
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold mb-4">Live Network State</h3>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700">Cells ({cells.length})</h4>
          <div className="text-xs space-y-1 mt-1">
            {cells.map(cell => (
              <div key={cell.id} className="flex justify-between font-mono">
                <span className="text-gray-600">{cell.id}:</span>
                <span className="text-blue-600">
                  {JSON.stringify(cell.outputs.get('default') || nil()).slice(0, 30)}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700">Functions ({functions.length})</h4>
          <div className="text-xs space-y-1 mt-1">
            {functions.map(func => (
              <div key={func.id} className="flex justify-between font-mono">
                <span className="text-gray-600">{func.id}:</span>
                <span className="text-green-600">
                  {JSON.stringify(func.outputs.get('default') || nil()).slice(0, 30)}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700">Networks ({networks.length})</h4>
          <div className="text-xs space-y-1 mt-1">
            {networks.map(net => (
              <div key={net.id} className="font-mono text-gray-600">
                {net.id} ({net.gadgets.size} gadgets)
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-3">
        Live view of all gadgets in the network.
        Networks are gadgets too!
      </p>
    </div>
  )
}

// ============================================================================
// Main Demo App
// ============================================================================

function ConstraintDemo() {
  const [mainNetwork] = useState(() => new Network('main'))
  
  return (
    <NetworkProvider network={mainNetwork}>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Propagation Network Demo</h1>
          <p className="text-gray-600 mb-8">
            Demonstrating bidirectional constraints, multiple writers, and lattice operations
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TemperatureConverter />
            <MultipleWritersDemo />
            <div className="md:col-span-2">
              <NetworkVisualizer />
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-bold text-blue-900 mb-2">Key Concepts</h2>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Cells</strong> perform lattice operations (associative, commutative, idempotent)</li>
              <li>• <strong>Functions</strong> perform fixed-arity computations</li>
              <li>• <strong>Networks</strong> are cells themselves (union operation)</li>
              <li>• Propagation handles cycles naturally - no infinite loops</li>
              <li>• Multiple writers resolved via lattice operations, not weights</li>
            </ul>
          </div>
        </div>
      </div>
    </NetworkProvider>
  )
}

// Mount the app
if (typeof window !== 'undefined') {
  const root = document.getElementById('root')
  if (!root) {
    const div = document.createElement('div')
    div.id = 'root'
    document.body.appendChild(div)
  }
  
  const container = document.getElementById('root')!
  const reactRoot = createRoot(container)
  reactRoot.render(<ConstraintDemo />)
}

export { ConstraintDemo }