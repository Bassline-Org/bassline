/**
 * Canvas - Container for the visual editor with pan and zoom support
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'

interface CanvasProps {
  children: React.ReactNode
  width?: number
  height?: number
  onCanvasClick?: (e: React.MouseEvent) => void
}

export function Canvas({ 
  children, 
  width = 2000, 
  height = 2000,
  onCanvasClick 
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  
  // Handle panning with middle mouse button or space + drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or left button with space key
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      }
    }
  }, [pan])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return
    
    const deltaX = e.clientX - panStart.current.x
    const deltaY = e.clientY - panStart.current.y
    
    setPan({
      x: panStart.current.panX + deltaX,
      y: panStart.current.panY + deltaY
    })
  }, [isPanning])
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])
  
  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prev => Math.min(Math.max(0.1, prev * delta), 3))
    }
  }, [])
  
  // Add global event listeners
  useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isPanning, handleMouseMove, handleMouseUp])
  
  // Reset view
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [])
  
  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          className="px-3 py-1 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
          onClick={resetView}
        >
          Reset View
        </button>
        <div className="px-3 py-1 bg-white border border-gray-300 rounded shadow">
          Zoom: {Math.round(zoom * 100)}%
        </div>
      </div>
      
      {/* Canvas container */}
      <div
        ref={containerRef}
        className={`relative w-full h-full ${isPanning ? 'cursor-move' : ''}`}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onClick={onCanvasClick}
      >
        {/* Grid background */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.5" fill="#d1d5db" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
        </svg>
        
        {/* Content container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: width,
            height: height
          }}
        >
          {children}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
        Shift+Drag to pan • Ctrl+Scroll to zoom • Click to deselect
      </div>
    </div>
  )
}