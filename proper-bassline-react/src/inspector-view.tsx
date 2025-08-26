/**
 * React component for rendering InspectorView gadgets
 */

import React, { useEffect, useRef, type CSSProperties } from 'react'
import { useGadget, useFunctionOutput } from './hooks'
import { InspectorView } from 'proper-bassline/meta/views/inspector-view'
import { NetworkCanvas } from './network-canvas'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { obj, num } from 'proper-bassline/src/lattice-types'
import type { Gadget } from '../../proper-bassline/src/gadget'
import type { Network } from '../../proper-bassline/src/network'

interface InspectorViewProps {
  target?: Gadget | null
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
  onPropertyChange?: (gadgetId: string, property: string, value: any) => void
}

/**
 * InspectorViewComponent - Renders an InspectorView gadget
 */
export function InspectorViewComponent({
  target = null,
  width = 400,
  height = 600,
  style = {},
  className = '',
  onPropertyChange
}: InspectorViewProps) {
  // Create the InspectorView
  const inspectorView = useGadget(() => new InspectorView(`inspector-${Math.random()}`))
  
  // Create input cells
  const targetCell = useGadget(() => {
    const cell = new OrdinalCell<Gadget | null>('target-cell')
    cell.userInput(null)
    return cell
  })
  
  const widthCell = useGadget(() => {
    const cell = new OrdinalCell<number>('width-cell')
    cell.userInput(width)
    return cell
  })
  
  const heightCell = useGadget(() => {
    const cell = new OrdinalCell<number>('height-cell')
    cell.userInput(height)
    return cell
  })
  
  // Connect once during render
  const isInitializedRef = useRef(false)
  if (!isInitializedRef.current) {
    // Set initial values
    targetCell.userInput(target)
    widthCell.userInput(width)
    heightCell.userInput(height)
    
    // Connect inputs
    inspectorView.connectFrom('target', targetCell)
    inspectorView.connectFrom('width', widthCell)
    inspectorView.connectFrom('height', heightCell)
    
    isInitializedRef.current = true
  }
  
  // Update cells when props change
  useEffect(() => {
    targetCell.userInput(target)
  }, [targetCell, target])
  
  useEffect(() => {
    widthCell.userInput(width)
  }, [widthCell, width])
  
  useEffect(() => {
    heightCell.userInput(height)
  }, [heightCell, height])
  
  // Get the output
  const outputValue = useFunctionOutput<any>(inspectorView)
  
  // Extract the Network/GroupGadget from the output
  let outputContainer: Network | null = null
  if (outputValue) {
    if (outputValue.type === 'object' && outputValue.value) {
      outputContainer = outputValue.value
    }
  }
  
  const containerStyle: CSSProperties = {
    width,
    height,
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    ...style
  }
  
  if (outputContainer) {
    return (
      <div className={`inspector-view ${className}`} style={containerStyle}>
        <NetworkCanvas 
          network={outputContainer}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
        />
      </div>
    )
  }
  
  return (
    <div className={`inspector-view ${className}`} style={containerStyle}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        {target ? 'Loading inspector...' : 'No gadget selected'}
      </div>
    </div>
  )
}

/**
 * LiveInspectorView - Inspector with live editing capabilities
 */
export function LiveInspectorViewComponent({
  target,
  width = 400,
  height = 600,
  style = {},
  className = '',
  onPropertyChange
}: InspectorViewProps) {
  // For now, just use the regular inspector
  // Live editing would require additional UI components
  // for input fields, sliders, etc.
  return (
    <InspectorViewComponent
      target={target}
      width={width}
      height={height}
      style={style}
      className={className}
      onPropertyChange={onPropertyChange}
    />
  )
}