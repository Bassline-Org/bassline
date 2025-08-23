/**
 * NodeRenderer - Renders a VisualNode as a draggable React component
 */

import React, { useCallback, useRef, useState, useEffect } from 'react'
import { useCell } from '../hooks'
import type { VisualNode } from 'proper-bassline/src/visual-node'
import { dict, num } from 'proper-bassline/src/types'

interface NodeRendererProps {
  node: VisualNode
  children?: React.ReactNode
  onSelect?: (nodeId: string) => void
  onConnectionStart?: (nodeId: string, outputName?: string) => void
  onConnectionEnd?: (nodeId: string, inputName?: string) => void
}

export function NodeRenderer({ 
  node, 
  children,
  onSelect,
  onConnectionStart,
  onConnectionEnd
}: NodeRendererProps) {
  const [position, setPosition] = useCell(node.position)
  const [size, setSize] = useCell(node.size)
  const [selected, setSelected] = useCell(node.selected)
  const [collapsed, setCollapsed] = useCell(node.collapsed)
  
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 })
  
  // Extract position values
  const x = (position as any)?.x?.value ?? 0
  const y = (position as any)?.y?.value ?? 0
  const width = (size as any)?.width?.value ?? 150
  const height = (size as any)?.height?.value ?? 100
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Select the node
    onSelect?.(node.id)
    setSelected(dict({ value: true }))
    
    // Start dragging
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: x,
      nodeY: y
    }
  }, [x, y, node.id, onSelect, setSelected])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - dragStart.current.x
    const deltaY = e.clientY - dragStart.current.y
    
    setPosition(dict({
      x: num(dragStart.current.nodeX + deltaX),
      y: num(dragStart.current.nodeY + deltaY)
    }))
  }, [isDragging, setPosition])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // Add global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  // Handle connection points
  const handleOutputClick = useCallback((e: React.MouseEvent, outputName?: string) => {
    e.stopPropagation()
    onConnectionStart?.(node.id, outputName)
  }, [node.id, onConnectionStart])
  
  const handleInputClick = useCallback((e: React.MouseEvent, inputName?: string) => {
    e.stopPropagation()
    onConnectionEnd?.(node.id, inputName)
  }, [node.id, onConnectionEnd])
  
  return (
    <div
      className={`absolute bg-white border-2 rounded-lg shadow-lg transition-shadow ${
        selected ? 'border-blue-500 shadow-xl' : 'border-gray-300'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: x,
        top: y,
        width: collapsed ? 'auto' : width,
        minWidth: 150,
        height: collapsed ? 'auto' : height,
        minHeight: 60,
        zIndex: selected ? 100 : 1
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-md flex justify-between items-center">
        <span className="font-semibold text-sm">{node.id}</span>
        <button
          className="text-gray-500 hover:text-gray-700 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            setCollapsed(dict({ value: !collapsed }))
          }}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      
      {/* Content */}
      {!collapsed && (
        <div className="p-3">
          {/* Connection points */}
          <div className="flex justify-between mb-2">
            {/* Input connection point */}
            <div
              className="w-3 h-3 bg-gray-400 rounded-full cursor-pointer hover:bg-blue-500"
              onClick={(e) => handleInputClick(e, 'default')}
              title="Input"
            />
            
            {/* Output connection point */}
            <div
              className="w-3 h-3 bg-gray-400 rounded-full cursor-pointer hover:bg-green-500"
              onClick={(e) => handleOutputClick(e, 'default')}
              title="Output"
            />
          </div>
          
          {/* Custom content or default display */}
          {children || (
            <div className="text-sm text-gray-600">
              {node.content ? (
                <div>
                  <div className="font-medium">Content:</div>
                  <div className="text-xs mt-1">{node.content.id}</div>
                </div>
              ) : (
                <div className="italic">Empty node</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}