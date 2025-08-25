/**
 * React component for rendering ListView gadgets
 */

import React, { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useGadget, useFunctionOutput, useTypedCell } from './hooks'
import { ListView, SelectableListView } from '../../proper-bassline/src/views/list-view'
import { NetworkCanvas } from './network-canvas'
import { Network } from '../../proper-bassline/src/network'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { set as makeSet, str, num, LatticeValue } from '../../proper-bassline/src/types'

interface ListViewProps {
  items: LatticeValue[]
  spacing?: number
  orientation?: 'vertical' | 'horizontal'
  itemHeight?: number
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
  onItemClick?: (item: LatticeValue, index: number) => void
}

/**
 * ListViewComponent - Renders a ListView gadget
 */
export function ListViewComponent({
  items,
  spacing = 10,
  orientation = 'vertical',
  itemHeight = 40,
  width = 300,
  height = 400,
  style = {},
  className = '',
  onItemClick
}: ListViewProps) {
  // Create the ListView and cells
  const listView = useGadget(() => new ListView(`list-${Math.random()}`))
  
  const itemsCell = useGadget(() => {
    const cell = new OrdinalCell<Set<LatticeValue>>('items-cell')
    cell.userInput(new Set<LatticeValue>())  // Start with empty
    return cell
  })
  
  const spacingCell = useGadget(() => {
    const cell = new OrdinalCell<number>('spacing-cell')
    cell.userInput(10)  // Default value
    return cell
  })
  
  const orientationCell = useGadget(() => {
    const cell = new OrdinalCell<string>('orientation-cell')
    cell.userInput('vertical')  // Default value
    return cell
  })
  
  const itemHeightCell = useGadget(() => {
    const cell = new OrdinalCell<number>('item-height-cell')
    cell.userInput(40)  // Default value
    return cell
  })
  
  // Connect once and set initial values
  const isInitializedRef = useRef(false)
  if (!isInitializedRef.current) {
    // Set the actual prop values
    itemsCell.userInput(new Set(items))
    spacingCell.userInput(spacing)
    orientationCell.userInput(orientation)
    itemHeightCell.userInput(itemHeight)
    
    // Connect them
    listView.connectFrom('items', itemsCell)
    listView.connectFrom('spacing', spacingCell)
    listView.connectFrom('orientation', orientationCell)
    listView.connectFrom('itemHeight', itemHeightCell)
    
    isInitializedRef.current = true
  }
  
  // Update cells when props change
  useEffect(() => {
    itemsCell.userInput(new Set(items))
  }, [itemsCell, items])
  
  useEffect(() => {
    spacingCell.userInput(spacing)
  }, [spacingCell, spacing])
  
  useEffect(() => {
    orientationCell.userInput(orientation)
  }, [orientationCell, orientation])
  
  useEffect(() => {
    itemHeightCell.userInput(itemHeight)
  }, [itemHeightCell, itemHeight])
  
  // Get the output container from ListView
  const outputValue = useFunctionOutput<any>(listView)
  
  // Extract the actual Network from the LatticeObject
  let outputContainer: Network | null = null
  if (outputValue) {
    // Check if it's a LatticeObject wrapping a Network
    if (outputValue.type === 'object' && outputValue.value instanceof Network) {
      outputContainer = outputValue.value
    } else if (outputValue instanceof Network) {
      outputContainer = outputValue
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
  
  // If we have output, render it
  if (outputContainer) {
    return (
      <div className={`list-view ${className}`} style={containerStyle}>
        <NetworkCanvas 
          network={outputContainer}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
        />
      </div>
    )
  }
  
  // Loading state
  return (
    <div className={`list-view ${className}`} style={containerStyle}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        Loading...
      </div>
    </div>
  )
}

/**
 * SelectableListViewComponent - ListView with selection
 */
export function SelectableListViewComponent({
  items,
  spacing = 10,
  orientation = 'vertical',
  itemHeight = 40,
  width = 300,
  height = 400,
  style = {},
  className = '',
  onItemClick,
  onSelectionChange
}: ListViewProps & {
  onSelectionChange?: (item: LatticeValue | null, index: number) => void
}) {
  // Create the SelectableListView
  const listView = useGadget(() => {
    return new SelectableListView(`selectable-list-${Math.random()}`)
  })
  
  // Subscribe to selection changes
  const [selectedIndex] = useTypedCell(listView.selectedIndex)
  const [selectedItem] = useTypedCell(listView.selectedItem)
  
  useEffect(() => {
    if (onSelectionChange && selectedIndex !== null) {
      onSelectionChange(selectedItem, selectedIndex)
    }
  }, [selectedIndex, selectedItem, onSelectionChange])
  
  // Create input cells
  const itemsCell = useGadget(() => {
    const cell = new OrdinalCell<Set<LatticeValue>>('items-cell')
    cell.userInput(new Set<LatticeValue>())  // Start with empty
    return cell
  })
  
  const spacingCell = useGadget(() => {
    const cell = new OrdinalCell<number>('spacing-cell')
    cell.userInput(10)  // Default value
    return cell
  })
  
  const orientationCell = useGadget(() => {
    const cell = new OrdinalCell<string>('orientation-cell')
    cell.userInput('vertical')  // Default value
    return cell
  })
  
  const itemHeightCell = useGadget(() => {
    const cell = new OrdinalCell<number>('item-height-cell')
    cell.userInput(40)  // Default value
    return cell
  })
  
  // Connect once and set initial values
  const isInitializedRef = useRef(false)
  if (!isInitializedRef.current) {
    // Set the actual prop values
    itemsCell.userInput(new Set(items))
    spacingCell.userInput(spacing)
    orientationCell.userInput(orientation)
    itemHeightCell.userInput(itemHeight)
    
    // Connect them
    listView.connectFrom('items', itemsCell)
    listView.connectFrom('spacing', spacingCell)
    listView.connectFrom('orientation', orientationCell)
    listView.connectFrom('itemHeight', itemHeightCell)
    
    isInitializedRef.current = true
  }
  
  // Update cells when props change
  useEffect(() => {
    itemsCell.userInput(new Set(items))
  }, [itemsCell, items])
  
  useEffect(() => {
    spacingCell.userInput(spacing)
  }, [spacingCell, spacing])
  
  useEffect(() => {
    orientationCell.userInput(orientation)
  }, [orientationCell, orientation])
  
  useEffect(() => {
    itemHeightCell.userInput(itemHeight)
  }, [itemHeightCell, itemHeight])
  
  // Get output
  const outputValue = useFunctionOutput<any>(listView)
  
  // Extract the actual Network from the LatticeObject
  let outputContainer: Network | null = null
  if (outputValue) {
    // Check if it's a LatticeObject wrapping a Network
    if (outputValue.type === 'object' && outputValue.value instanceof Network) {
      outputContainer = outputValue.value
    } else if (outputValue instanceof Network) {
      outputContainer = outputValue
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
  
  // Handle item clicks
  const handleCanvasClick = (position: { x: number, y: number }) => {
    if (!outputContainer || !onItemClick) return
    
    // Calculate which item was clicked based on position
    const index = Math.floor(position.y / (itemHeight + spacing))
    if (index >= 0 && index < items.length) {
      listView.select(index, items[index])
      onItemClick(items[index], index)
    }
  }
  
  if (outputContainer) {
    return (
      <div className={`selectable-list-view ${className}`} style={containerStyle}>
        <NetworkCanvas 
          network={outputContainer}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
          onCanvasClick={handleCanvasClick}
        />
        {selectedIndex !== null && selectedIndex >= 0 && (
          <div style={{
            position: 'absolute',
            top: selectedIndex * (itemHeight + spacing),
            left: 0,
            right: 0,
            height: itemHeight,
            border: '2px solid #3b82f6',
            borderRadius: '4px',
            pointerEvents: 'none'
          }} />
        )}
      </div>
    )
  }
  
  return (
    <div className={`selectable-list-view ${className}`} style={containerStyle}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        Loading...
      </div>
    </div>
  )
}