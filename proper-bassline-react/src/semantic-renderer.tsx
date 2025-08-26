/**
 * SemanticGadgetRenderer - Renders gadgets differently based on zoom level
 * 
 * This is the core of semantic zoom. As you zoom in/out, gadgets reveal
 * different levels of detail and interaction.
 */

import React from 'react'
import type { Gadget } from 'proper-bassline/src/gadget'
import { Cell } from 'proper-bassline/src/cell'
import { FunctionGadget } from 'proper-bassline/src/function'
import { Network } from 'proper-bassline/src/network'
import { useCell } from './hooks'
import { getGadgetValue } from 'proper-bassline/src/value-helpers'

interface SemanticGadgetRendererProps {
  gadget: Gadget
  x: number
  y: number
  zoom: number
}

export function SemanticGadgetRenderer({ gadget, x, y, zoom }: SemanticGadgetRendererProps) {
  // Subscribe to gadget output for live updates
  const [value] = useCell(gadget instanceof Cell ? gadget : null)
  
  // Determine render level based on zoom
  const renderLevel = getZoomLevel(zoom)
  
  // Common styles
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    transition: 'all 0.2s ease-out',
    cursor: 'pointer',
    userSelect: 'none'
  }
  
  // Render based on zoom level
  switch (renderLevel) {
    case 'dot':
      return <GadgetDot gadget={gadget} style={baseStyle} />
    
    case 'compact':
      return <GadgetCompact gadget={gadget} value={value} style={baseStyle} />
    
    case 'normal':
      return <GadgetNormal gadget={gadget} value={value} style={baseStyle} />
    
    case 'detailed':
      return <GadgetDetailed gadget={gadget} value={value} style={baseStyle} />
    
    case 'internal':
      return <GadgetInternal gadget={gadget} value={value} style={baseStyle} />
  }
}

function getZoomLevel(zoom: number): 'dot' | 'compact' | 'normal' | 'detailed' | 'internal' {
  if (zoom < 0.3) return 'dot'
  if (zoom < 0.6) return 'compact'
  if (zoom < 1.5) return 'normal'
  if (zoom < 3) return 'detailed'
  return 'internal'
}

// Zoom level 0.1-0.3: Just a dot with tooltip
function GadgetDot({ gadget, style }: { gadget: Gadget; style: React.CSSProperties }) {
  return (
    <div
      style={style}
      className="group"
      title={gadget.id}
    >
      <div className="w-2 h-2 bg-blue-500 rounded-full" />
      <div className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 
                      px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
        {gadget.id}
      </div>
    </div>
  )
}

// Zoom level 0.3-0.6: Compact box with name and value
function GadgetCompact({ gadget, value, style }: { gadget: Gadget; value: any; style: React.CSSProperties }) {
  const displayValue = formatValue(value)
  const typeColor = getGadgetColor(gadget)
  
  return (
    <div
      style={style}
      className={`px-2 py-1 rounded shadow-sm border ${typeColor}`}
    >
      <div className="text-xs font-medium truncate">{gadget.id}</div>
      {displayValue && (
        <div className="text-xs text-gray-600 truncate">{displayValue}</div>
      )}
    </div>
  )
}

// Zoom level 0.6-1.5: Normal view with ports
function GadgetNormal({ gadget, value, style }: { gadget: Gadget; value: any; style: React.CSSProperties }) {
  const displayValue = formatValue(value)
  const typeColor = getGadgetColor(gadget)
  const { inputs, outputs } = getGadgetPorts(gadget)
  
  return (
    <div
      style={style}
      className={`relative px-4 py-3 rounded-lg shadow-md border-2 ${typeColor} min-w-[120px]`}
    >
      {/* Input ports */}
      {inputs.length > 0 && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 space-y-1">
          {inputs.map((port, i) => (
            <div
              key={port}
              className="w-3 h-3 bg-gray-400 rounded-full border border-white"
              title={port}
            />
          ))}
        </div>
      )}
      
      {/* Content */}
      <div className="text-sm font-semibold">{gadget.id}</div>
      <div className="text-xs text-gray-500">{getGadgetType(gadget)}</div>
      {displayValue && (
        <div className="text-sm mt-1 font-mono">{displayValue}</div>
      )}
      
      {/* Output ports */}
      {outputs.length > 0 && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 space-y-1">
          {outputs.map((port, i) => (
            <div
              key={port}
              className="w-3 h-3 bg-blue-400 rounded-full border border-white"
              title={port}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Zoom level 1.5-3: Detailed view with metadata
function GadgetDetailed({ gadget, value, style }: { gadget: Gadget; value: any; style: React.CSSProperties }) {
  const displayValue = formatValue(value)
  const typeColor = getGadgetColor(gadget)
  const { inputs, outputs } = getGadgetPorts(gadget)
  
  return (
    <div
      style={style}
      className={`relative px-6 py-4 rounded-xl shadow-lg border-2 ${typeColor} min-w-[180px]`}
    >
      {/* Header */}
      <div className="border-b pb-2 mb-2">
        <div className="text-base font-bold">{gadget.id}</div>
        <div className="text-xs text-gray-500">{getGadgetType(gadget)}</div>
      </div>
      
      {/* Input ports with labels */}
      {inputs.length > 0 && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 space-y-2">
          {inputs.map((port, i) => (
            <div key={port} className="flex items-center">
              <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white" />
              <span className="text-xs ml-1 text-gray-600">{port}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Value display */}
      {displayValue && (
        <div className="bg-gray-50 rounded p-2 my-2">
          <div className="text-xs text-gray-500 mb-1">Current Value:</div>
          <div className="text-sm font-mono">{displayValue}</div>
        </div>
      )}
      
      {/* Metadata */}
      <div className="text-xs text-gray-400 mt-2">
        Type: {gadget.constructor.name}
      </div>
      
      {/* Output ports with labels */}
      {outputs.length > 0 && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 space-y-2">
          {outputs.map((port, i) => (
            <div key={port} className="flex items-center">
              <span className="text-xs mr-1 text-gray-600">{port}</span>
              <div className="w-4 h-4 bg-blue-400 rounded-full border-2 border-white" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Zoom level 3+: Internal view - see inside networks
function GadgetInternal({ gadget, value, style }: { gadget: Gadget; value: any; style: React.CSSProperties }) {
  const isNetwork = gadget instanceof Network
  
  if (!isNetwork) {
    // Non-networks just show detailed view at max zoom
    return <GadgetDetailed gadget={gadget} value={value} style={style} />
  }
  
  // For networks, show internal structure
  return (
    <div
      style={style}
      className="relative p-8 rounded-2xl bg-white/80 backdrop-blur shadow-xl border-2 border-blue-500 min-w-[400px] min-h-[300px]"
    >
      {/* Network header */}
      <div className="absolute top-2 left-4 text-sm font-bold text-blue-600">
        Network: {gadget.id}
      </div>
      
      {/* Internal gadgets */}
      <div className="mt-8">
        <div className="text-xs text-gray-500 mb-2">Internal Gadgets:</div>
        {Array.from((gadget as Network).gadgets).map((internalGadget, i) => (
          <div
            key={internalGadget.id}
            className="inline-block m-2 px-3 py-2 bg-gray-100 rounded shadow-sm"
          >
            <div className="text-xs font-medium">{internalGadget.id}</div>
            <div className="text-xs text-gray-500">{getGadgetType(internalGadget)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper functions

function formatValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2).slice(0, 50)
  }
  return String(value).slice(0, 50)
}

function getGadgetColor(gadget: Gadget): string {
  if (gadget instanceof Cell) return 'bg-blue-50 border-blue-300'
  if (gadget instanceof FunctionGadget) return 'bg-green-50 border-green-300'
  if (gadget instanceof Network) return 'bg-purple-50 border-purple-300'
  return 'bg-gray-50 border-gray-300'
}

function getGadgetType(gadget: Gadget): string {
  if (gadget instanceof Cell) return 'Cell'
  if (gadget instanceof FunctionGadget) return 'Function'
  if (gadget instanceof Network) return 'Network'
  return 'Gadget'
}

function getGadgetPorts(gadget: Gadget): { inputs: string[]; outputs: string[] } {
  if (gadget instanceof FunctionGadget) {
    return {
      inputs: (gadget as any).inputNames || [],
      outputs: ['output']
    }
  }
  
  if (gadget instanceof Cell) {
    return {
      inputs: ['input'],
      outputs: ['output']
    }
  }
  
  if (gadget instanceof Network) {
    const boundaries = (gadget as Network).getBoundaries()
    const names = boundaries.map(b => b.id.split('-').pop() || b.id)
    return {
      inputs: names,
      outputs: names // Boundaries are bidirectional
    }
  }
  
  return { inputs: [], outputs: [] }
}