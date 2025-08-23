/**
 * Proper Demo - Demonstrating the new Cell/Function architecture with UI
 */

import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Network } from './src/network'
import { NetworkProvider } from './src/react-integration'
import { Calculator } from './src/apps/calculator-component'

// Simple desktop-like container
function Desktop({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">
          Proper Bassline Demo
        </h1>
        <p className="text-white/80 mb-8">
          Demonstrating the new Cell/Function architecture with semi-lattice operations
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Window component
function Window({ 
  title, 
  children 
}: { 
  title: string
  children: React.ReactNode 
}) {
  const [isMinimized, setIsMinimized] = useState(false)
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
      <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
        <h3 className="text-white font-semibold">{title}</h3>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-gray-400 hover:text-white"
        >
          {isMinimized ? '🔽' : '🔼'}
        </button>
      </div>
      {!isMinimized && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  )
}

// Network visualizer (simple version)
function NetworkVisualizer({ network }: { network: Network }) {
  const [, forceUpdate] = useState({})
  
  // Simple polling for updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({})
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="text-white space-y-2">
      <div className="text-sm text-gray-400">Network Stats:</div>
      <div>Gadgets: {network.gadgets.size}</div>
      <div className="text-xs space-y-1 mt-4">
        {Array.from(network.gadgets).map(gadget => (
          <div key={gadget.id} className="text-gray-300">
            {gadget.id}: {gadget.constructor.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// Info panel
function InfoPanel() {
  return (
    <div className="text-white space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Key Concepts:</h4>
        <ul className="text-sm space-y-1 text-gray-300">
          <li>• <strong>Cells</strong>: Semi-lattice operations (Max, Min, Union)</li>
          <li>• <strong>Functions</strong>: Fixed-arity operations (Add, Multiply)</li>
          <li>• <strong>Networks</strong>: Are themselves Cells (union operation)</li>
          <li>• <strong>Propagation</strong>: Automatic, handles cycles naturally</li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-2">Architecture Benefits:</h4>
        <ul className="text-sm space-y-1 text-gray-300">
          <li>• No weight/authority complexity</li>
          <li>• Monotonic growth (no contradictions)</li>
          <li>• Memory safe (WeakRef connections)</li>
          <li>• Composable (networks in networks)</li>
        </ul>
      </div>
    </div>
  )
}

// Main demo app
function ProperDemo() {
  const [mainNetwork] = useState(() => new Network('main'))
  
  return (
    <NetworkProvider network={mainNetwork}>
      <Desktop>
        <Window title="Calculator App">
          <Calculator network={mainNetwork} />
        </Window>
        
        <Window title="Network Inspector">
          <NetworkVisualizer network={mainNetwork} />
        </Window>
        
        <Window title="About">
          <InfoPanel />
        </Window>
      </Desktop>
    </NetworkProvider>
  )
}

// Mount the app
function mount() {
  const root = document.getElementById('root')
  if (!root) {
    const div = document.createElement('div')
    div.id = 'root'
    document.body.appendChild(div)
  }
  
  const container = document.getElementById('root')!
  const reactRoot = createRoot(container)
  reactRoot.render(<ProperDemo />)
}

// Auto-mount if this is the entry point
if (typeof window !== 'undefined') {
  mount()
}

export { ProperDemo, Calculator }