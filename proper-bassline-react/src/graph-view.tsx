/**
 * React component for rendering GraphView gadgets
 */

import React, { useEffect, useRef, type CSSProperties } from 'react'
import { useGadget, useFunctionOutput, useNetwork } from './hooks'
import { GraphView, InteractiveGraphView } from '../../proper-bassline/src/views/graph-view'
import { NetworkCanvas } from './network-canvas'
import { Network } from '../../proper-bassline/src/network'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { obj, num, str } from '../../proper-bassline/src/types'

interface GraphViewProps {
  network?: Network
  width?: number
  height?: number
  nodeSpacing?: number
  style?: CSSProperties
  className?: string
  interactive?: boolean
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
}

/**
 * GraphViewComponent - Renders a GraphView gadget
 */
export function GraphViewComponent({
  network,
  width = 800,
  height = 600,
  nodeSpacing = 100,
  style = {},
  className = '',
  interactive = false,
  onNodeClick,
  onNodeHover
}: GraphViewProps) {
  // Use the network from context if not provided
  const contextNetwork = useNetwork()
  const targetNetwork = network || contextNetwork
  
  // Create the GraphView
  const graphView = useGadget(() => {
    if (interactive) {
      return new InteractiveGraphView(`graph-${Math.random()}`)
    }
    return new GraphView(`graph-${Math.random()}`)
  })
  
  // Create input cells
  const networkCell = useGadget(() => {
    const cell = new OrdinalCell<Network>('network-cell')
    cell.userInput(targetNetwork)
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
  
  const nodeSpacingCell = useGadget(() => {
    const cell = new OrdinalCell<number>('spacing-cell')
    cell.userInput(nodeSpacing)
    return cell
  })
  
  // Interactive cells (only for InteractiveGraphView)
  const selectedNodeCell = useGadget(() => {
    const cell = new OrdinalCell<string>('selected-cell')
    cell.userInput('')
    return cell
  })
  
  const hoveredNodeCell = useGadget(() => {
    const cell = new OrdinalCell<string>('hovered-cell')
    cell.userInput('')
    return cell
  })
  
  // Connect once during render
  const isInitializedRef = useRef(false)
  if (!isInitializedRef.current) {
    // Connect base inputs
    graphView.connectFrom('network', networkCell)
    graphView.connectFrom('width', widthCell)
    graphView.connectFrom('height', heightCell)
    graphView.connectFrom('nodeSpacing', nodeSpacingCell)
    
    // Connect interactive inputs if needed
    if (interactive && graphView instanceof InteractiveGraphView) {
      graphView.connectFrom('selectedNodeId', selectedNodeCell)
      graphView.connectFrom('hoveredNodeId', hoveredNodeCell)
    }
    
    isInitializedRef.current = true
  }
  
  // Update cells when props change
  useEffect(() => {
    networkCell.userInput(targetNetwork)
  }, [networkCell, targetNetwork])
  
  useEffect(() => {
    widthCell.userInput(width)
  }, [widthCell, width])
  
  useEffect(() => {
    heightCell.userInput(height)
  }, [heightCell, height])
  
  useEffect(() => {
    nodeSpacingCell.userInput(nodeSpacing)
  }, [nodeSpacingCell, nodeSpacing])
  
  // Get the output
  const outputValue = useFunctionOutput<any>(graphView)
  
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
  
  // Handle interactions
  const handleCanvasClick = (position: { x: number, y: number }) => {
    if (!interactive || !onNodeClick) return
    // Would need to map position to node
  }
  
  const handleCanvasHover = (position: { x: number, y: number } | null) => {
    if (!interactive || !onNodeHover) return
    // Would need to map position to node
  }
  
  if (outputContainer) {
    return (
      <div className={`graph-view ${className}`} style={containerStyle}>
        <NetworkCanvas 
          network={outputContainer}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
          onCanvasClick={interactive ? handleCanvasClick : undefined}
        />
      </div>
    )
  }
  
  return (
    <div className={`graph-view ${className}`} style={containerStyle}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        Loading graph...
      </div>
    </div>
  )
}