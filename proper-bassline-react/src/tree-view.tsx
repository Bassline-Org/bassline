/**
 * React component for rendering TreeView gadgets
 */

import React, { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { useGadget, useFunctionOutput, useNetwork } from './hooks'
import { TreeView, InteractiveTreeView } from '../../proper-bassline/src/views/tree-view'
import { NetworkCanvas } from './network-canvas'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { obj, num, str, set } from '../../proper-bassline/src/types'
import type { LatticeValue } from '../../proper-bassline/src/types'
import type { Network } from '../../proper-bassline/src/network'

interface TreeViewProps {
  root: LatticeValue
  width?: number
  height?: number
  nodeHeight?: number
  indent?: number
  expandedNodes?: Set<string>
  interactive?: boolean
  style?: CSSProperties
  className?: string
  onNodeClick?: (nodeId: string) => void
  onNodeExpand?: (nodeId: string, expanded: boolean) => void
}

/**
 * TreeViewComponent - Renders a TreeView gadget
 */
export function TreeViewComponent({
  root,
  width = 600,
  height = 800,
  nodeHeight = 30,
  indent = 20,
  expandedNodes = new Set<string>(),
  interactive = false,
  style = {},
  className = '',
  onNodeClick,
  onNodeExpand
}: TreeViewProps) {
  const [localExpandedNodes, setLocalExpandedNodes] = useState(expandedNodes)
  
  // Create the TreeView
  const treeView = useGadget(() => {
    if (interactive) {
      return new InteractiveTreeView(`tree-${Math.random()}`)
    }
    return new TreeView(`tree-${Math.random()}`)
  })
  
  // Create input cells
  const rootCell = useGadget(() => {
    const cell = new OrdinalCell<LatticeValue>('root-cell')
    cell.userInput(root)
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
  
  const nodeHeightCell = useGadget(() => {
    const cell = new OrdinalCell<number>('node-height-cell')
    cell.userInput(nodeHeight)
    return cell
  })
  
  const indentCell = useGadget(() => {
    const cell = new OrdinalCell<number>('indent-cell')
    cell.userInput(indent)
    return cell
  })
  
  const expandedNodesCell = useGadget(() => {
    const cell = new OrdinalCell<Set<string>>('expanded-nodes-cell')
    cell.userInput(localExpandedNodes)
    return cell
  })
  
  const clickedNodeCell = useGadget(() => {
    const cell = new OrdinalCell<string>('clicked-node-cell')
    cell.userInput('')
    return cell
  })
  
  // Connect once during render
  const isInitializedRef = useRef(false)
  if (!isInitializedRef.current) {
    // Connect base inputs
    treeView.connectFrom('root', rootCell)
    treeView.connectFrom('width', widthCell)
    treeView.connectFrom('height', heightCell)
    treeView.connectFrom('nodeHeight', nodeHeightCell)
    treeView.connectFrom('indent', indentCell)
    treeView.connectFrom('expandedNodes', expandedNodesCell)
    
    // Connect interactive inputs if needed
    if (interactive && treeView instanceof InteractiveTreeView) {
      treeView.connectFrom('clickedNodeId', clickedNodeCell)
    }
    
    isInitializedRef.current = true
  }
  
  // Update cells when props change
  useEffect(() => {
    rootCell.userInput(root)
  }, [rootCell, root])
  
  useEffect(() => {
    widthCell.userInput(width)
  }, [widthCell, width])
  
  useEffect(() => {
    heightCell.userInput(height)
  }, [heightCell, height])
  
  useEffect(() => {
    nodeHeightCell.userInput(nodeHeight)
  }, [nodeHeightCell, nodeHeight])
  
  useEffect(() => {
    indentCell.userInput(indent)
  }, [indentCell, indent])
  
  useEffect(() => {
    expandedNodesCell.userInput(localExpandedNodes)
  }, [expandedNodesCell, localExpandedNodes])
  
  // Handle node clicks
  const handleNodeClick = useCallback((nodeId: string) => {
    if (interactive) {
      // Toggle expansion
      setLocalExpandedNodes(prev => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
          onNodeExpand?.(nodeId, false)
        } else {
          next.add(nodeId)
          onNodeExpand?.(nodeId, true)
        }
        return next
      })
      
      // Update the clicked node cell
      clickedNodeCell.userInput(nodeId)
    }
    
    onNodeClick?.(nodeId)
  }, [interactive, clickedNodeCell, onNodeClick, onNodeExpand])
  
  // Get the output
  const outputValue = useFunctionOutput<any>(treeView)
  
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
      <div className={`tree-view ${className}`} style={containerStyle}>
        <NetworkCanvas 
          network={outputContainer}
          width={width}
          height={height}
          style={{ border: 'none', backgroundColor: 'transparent' }}
          onCanvasClick={interactive ? (pos) => {
            // Would need to map position to node
            // For now, use a simpler approach with DOM events
          } : undefined}
        />
      </div>
    )
  }
  
  return (
    <div className={`tree-view ${className}`} style={containerStyle}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        Loading tree...
      </div>
    </div>
  )
}