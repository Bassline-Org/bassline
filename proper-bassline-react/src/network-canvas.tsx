/**
 * NetworkCanvas - Renders all VisualGadgets from a network
 * 
 * This component demonstrates the "network → React" direction:
 * Takes a propagation network and renders all visual gadgets as React components.
 */

import React, { useEffect, useState, useMemo, CSSProperties } from 'react'
import { Network } from '../../proper-bassline/src/network'
import { VisualGadget } from '../../proper-bassline/src/visual-gadget'
import { ViewGadget } from '../../proper-bassline/src/view-gadget'
import { QueryGadget } from '../../proper-bassline/src/query-gadget'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { networkValue } from '../../proper-bassline/src/network-value'
import { str } from '../../proper-bassline/src/types'
import { useGadget, useCell, useFunctionOutput } from './hooks'
import { VisualGadgetRenderer } from './react-visuals'

// ============================================================================
// Types
// ============================================================================

interface NetworkCanvasProps {
  network: Network
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

// ============================================================================
// NetworkCanvas Component
// ============================================================================

/**
 * Canvas that automatically renders all VisualGadgets from a network
 */
export function NetworkCanvas({
  network,
  width = 800,
  height = 600,
  style = {},
  className = '',
  children
}: NetworkCanvasProps) {
  // Create a QueryGadget to watch for visual gadgets
  const queryGadget = useGadget(() => {
    const query = new QueryGadget('canvas-query')
    // Wire it to observe the network
    const networkCell = new OrdinalCell('canvas-network-cell')
    networkCell.userInput(networkValue(network))
    query.connectFrom('network', networkCell)
    
    // Set selector for all visual gadgets
    const selectorCell = new OrdinalCell('canvas-selector-cell')
    // Query for all VisualGadgets (base class)
    selectorCell.userInput(str('*'))  // Get all gadgets for now
    query.connectFrom('selector', selectorCell)
    
    // Trigger initial computation
    query.compute()
    
    return query
  }, `canvas-query-${network.id}`)
  
  // Subscribe to query results - QueryGadget is a FunctionGadget, so we need to get its output
  const queryResults = useFunctionOutput(queryGadget)
  
  // Convert query results to visual gadgets
  const visualGadgets = useMemo(() => {
    const gadgetSet = new Set<VisualGadget>()
    
    console.log('Query results type:', typeof queryResults, queryResults)
    if (queryResults) {
      console.log('Query results instanceof Set:', queryResults instanceof Set)
      console.log('Query results size:', (queryResults as any).size)
    }
    
    // The query returns all gadgets, we need to filter for VisualGadgets
    if (queryResults && queryResults instanceof Set) {
      // The results are a set of gadget IDs (LatticeValues)
      for (const idValue of queryResults) {
        const id = typeof idValue === 'string' ? idValue : idValue?.value
        if (id) {
          const gadget = network.getByPath(id)
          console.log(`Checking gadget ${id}:`, gadget?.constructor?.name, gadget instanceof VisualGadget)
          if (gadget instanceof VisualGadget) {
            gadgetSet.add(gadget)
          }
        }
      }
    } else {
      // Fallback: directly query the network
      console.log('Fallback: directly querying network')
      for (const gadget of network.gadgets) {
        if (gadget instanceof VisualGadget) {
          gadgetSet.add(gadget)
        }
      }
    }
    
    console.log('NetworkCanvas visual gadgets:', gadgetSet.size, 'from network with', network.gadgets.size, 'total gadgets')
    // Log the actual gadgets found
    for (const g of gadgetSet) {
      console.log('  - Found visual gadget:', g.id, g.constructor.name)
    }
    return gadgetSet
  }, [queryResults, network])
  
  const canvasStyle: CSSProperties = {
    position: 'relative',
    width: width,
    height: height,
    border: '1px solid #ccc',
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    ...style
  }
  
  return (
    <div 
      className={`network-canvas ${className}`}
      style={canvasStyle}
      data-network-id={network.id}
    >
      {/* Render all visual gadgets */}
      {Array.from(visualGadgets).map(gadget => (
        <VisualGadgetRenderer 
          key={gadget.id}
          gadget={gadget}
        />
      ))}
      
      {/* Additional children (can be React components that create gadgets) */}
      {children}
    </div>
  )
}

// ============================================================================
// ViewCanvas Component (uses ViewGadget system)
// ============================================================================

interface ViewCanvasProps {
  network: Network
  selector?: string
  layout?: 'list' | 'grid' | 'tree'
  layoutParams?: Record<string, any>
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
}

/**
 * Canvas that uses the ViewGadget system to query and render visual gadgets
 */
export function ViewCanvas({
  network,
  selector = 'VisualGadget',
  layout = 'list',
  layoutParams = {},
  width = 800,
  height = 600,
  style = {},
  className = ''
}: ViewCanvasProps) {
  // Create a ViewGadget to handle querying and projection
  const view = useGadget(() => {
    const viewGadget = new ViewGadget('canvas-view')
    viewGadget.observeNetwork(network)
    viewGadget.setSelector(selector)
    viewGadget.setLayout(layout)
    viewGadget.setLayoutParams(layoutParams)
    return viewGadget
  }, `canvas-view-${network.id}`)
  
  // Subscribe to the projection container
  const [projectionOutput] = useCell(view.projection.results)
  
  // Force updates when view parameters change
  useEffect(() => {
    view.setSelector(selector)
  }, [view, selector])
  
  useEffect(() => {
    view.setLayout(layout)
  }, [view, layout])
  
  useEffect(() => {
    view.setLayoutParams(layoutParams)
  }, [view, layoutParams])
  
  const canvasStyle: CSSProperties = {
    position: 'relative',
    width: width,
    height: height,
    border: '1px solid #ccc',
    overflow: 'auto',
    backgroundColor: '#f8f9fa',
    ...style
  }
  
  return (
    <div 
      className={`view-canvas ${className}`}
      style={canvasStyle}
      data-network-id={network.id}
      data-view-selector={selector}
      data-view-layout={layout}
    >
      {/* Render the projection container's visual gadgets */}
      {Array.from(view.projection.container.gadgets).map(gadget => {
        if (gadget instanceof VisualGadget) {
          return (
            <VisualGadgetRenderer 
              key={gadget.id}
              gadget={gadget}
            />
          )
        }
        return null
      })}
    </div>
  )
}

// ============================================================================
// Interactive Canvas
// ============================================================================

interface InteractiveCanvasProps extends NetworkCanvasProps {
  onCanvasClick?: (position: { x: number, y: number }) => void
  onCanvasDrag?: (start: { x: number, y: number }, end: { x: number, y: number }) => void
  zoom?: number
  pan?: { x: number, y: number }
}

/**
 * Canvas with built-in interaction capabilities
 */
export function InteractiveCanvas({
  network,
  width = 800,
  height = 600,
  style = {},
  className = '',
  onCanvasClick,
  onCanvasDrag,
  zoom = 1,
  pan = { x: 0, y: 0 },
  children
}: InteractiveCanvasProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  
  const handleMouseDown = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const position = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom
    }
    
    setIsDragging(true)
    setDragStart(position)
    
    if (onCanvasClick) {
      onCanvasClick(position)
    }
  }
  
  const handleMouseUp = (event: React.MouseEvent) => {
    if (isDragging && onCanvasDrag) {
      const rect = event.currentTarget.getBoundingClientRect()
      const position = {
        x: (event.clientX - rect.left - pan.x) / zoom,
        y: (event.clientY - rect.top - pan.y) / zoom
      }
      
      onCanvasDrag(dragStart, position)
    }
    
    setIsDragging(false)
  }
  
  const canvasStyle: CSSProperties = {
    position: 'relative',
    width: width,
    height: height,
    border: '1px solid #ccc',
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    cursor: isDragging ? 'grabbing' : 'grab',
    ...style
  }
  
  const contentStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
    width: '100%',
    height: '100%'
  }
  
  return (
    <div 
      className={`interactive-canvas ${className}`}
      style={canvasStyle}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-network-id={network.id}
    >
      <div style={contentStyle}>
        <NetworkCanvas 
          network={network}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
        >
          {children}
        </NetworkCanvas>
      </div>
    </div>
  )
}