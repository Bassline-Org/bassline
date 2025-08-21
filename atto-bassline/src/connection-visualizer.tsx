/**
 * Connection Visualizer Component
 * Renders SVG wires between connected gadgets
 */

import React, { useEffect, useState, useRef, type ReactNode } from 'react'
import type { ConnectionManagerAPI } from './use-connection-manager'
import type { Connection } from './connection-manager'

interface ConnectionVisualizerProps {
  children: ReactNode
  manager: ConnectionManagerAPI
}

interface ElementPosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Visualizes connections between gadgets as SVG wires
 */
export function ConnectionVisualizer({ children, manager }: ConnectionVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [elementPositions, setElementPositions] = useState<Map<string, ElementPosition>>(new Map())
  
  // Update element positions when DOM changes
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return
      
      const positions = new Map<string, ElementPosition>()
      const connectables = containerRef.current.querySelectorAll('.connectable')
      
      connectables.forEach((element) => {
        const gadgetId = element.getAttribute('title')?.split('•')[1]?.trim()
        if (gadgetId) {
          const rect = element.getBoundingClientRect()
          const containerRect = containerRef.current!.getBoundingClientRect()
          positions.set(gadgetId, {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
          })
        }
      })
      
      // Only update if positions actually changed to prevent infinite loops
      setElementPositions(prevPositions => {
        // Check if any positions changed
        if (prevPositions.size !== positions.size) {
          return positions
        }
        
        for (const [id, pos] of positions) {
          const prev = prevPositions.get(id)
          if (!prev || 
              prev.x !== pos.x || 
              prev.y !== pos.y || 
              prev.width !== pos.width || 
              prev.height !== pos.height) {
            return positions
          }
        }
        
        return prevPositions // No changes, return previous state
      })
    }
    
    // Update positions on mount and when connections change (but debounced)
    const timeoutId = setTimeout(updatePositions, 100)
    
    // Also update on window resize
    window.addEventListener('resize', updatePositions)
    
    // Use MutationObserver to detect DOM changes (but throttled)
    let observerTimeout: NodeJS.Timeout | null = null
    const throttledUpdate = () => {
      if (observerTimeout) clearTimeout(observerTimeout)
      observerTimeout = setTimeout(updatePositions, 50)
    }
    
    const observer = new MutationObserver(throttledUpdate)
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      })
    }
    
    return () => {
      clearTimeout(timeoutId)
      if (observerTimeout) clearTimeout(observerTimeout)
      window.removeEventListener('resize', updatePositions)
      observer.disconnect()
    }
  }, [manager.activeConnections.length]) // Only depend on connection count, not the array itself
  
  // Calculate path for connection wire
  const getConnectionPath = (connection: Connection): string | null => {
    const fromPos = elementPositions.get(connection.from.gadgetId)
    const toPos = elementPositions.get(connection.to.gadgetId)
    
    if (!fromPos || !toPos) return null
    
    // Calculate connection points (center of elements for now)
    const fromX = fromPos.x + fromPos.width / 2
    const fromY = fromPos.y + fromPos.height / 2
    const toX = toPos.x + toPos.width / 2
    const toY = toPos.y + toPos.height / 2
    
    // Create a bezier curve
    const controlPointOffset = Math.abs(toX - fromX) * 0.5
    const controlX1 = fromX + controlPointOffset
    const controlY1 = fromY
    const controlX2 = toX - controlPointOffset
    const controlY2 = toY
    
    return `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`
  }
  
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* SVG overlay for wires */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <defs>
          {/* Arrow marker for showing direction */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="#9C27B0"
            />
          </marker>
          
          {/* Animated gradient for data flow */}
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9C27B0" stopOpacity="0.2">
              <animate
                attributeName="offset"
                values="0;1;0"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#9C27B0" stopOpacity="1">
              <animate
                attributeName="offset"
                values="0;1;0"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#9C27B0" stopOpacity="0.2">
              <animate
                attributeName="offset"
                values="0;1;0"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
        
        {/* Render connection wires */}
        {manager.activeConnections.map(connection => {
          const path = getConnectionPath(connection)
          if (!path) return null
          
          return (
            <g key={connection.id}>
              {/* Shadow/glow effect */}
              <path
                d={path}
                stroke="#9C27B0"
                strokeWidth="6"
                fill="none"
                opacity="0.2"
                strokeLinecap="round"
              />
              
              {/* Main wire */}
              <path
                d={path}
                stroke="#9C27B0"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
                strokeLinecap="round"
                style={{
                  cursor: 'pointer',
                  pointerEvents: 'stroke'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Delete connection from ${connection.from.contactName} to ${connection.to.contactName}?`)) {
                    manager.deleteConnection(connection.id)
                  }
                }}
              />
              
              {/* Animated flow indicator */}
              <path
                d={path}
                stroke="url(#flowGradient)"
                strokeWidth="3"
                fill="none"
                opacity="0.6"
                strokeLinecap="round"
                pointerEvents="none"
              />
              
              {/* Connection label */}
              <text
                x={elementPositions.get(connection.from.gadgetId)?.x! + elementPositions.get(connection.from.gadgetId)?.width! / 2}
                y={elementPositions.get(connection.from.gadgetId)?.y! + elementPositions.get(connection.from.gadgetId)?.height! / 2 - 10}
                fill="#9C27B0"
                fontSize="10"
                textAnchor="middle"
                pointerEvents="none"
              >
                {connection.from.contactName} → {connection.to.contactName}
              </text>
            </g>
          )
        })}
      </svg>
      
      {/* Render children (the actual components) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
      
      {/* Connection mode overlay */}
      {manager.connectionMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333'
            }}
          >
            {manager.connectionStatus === 'selecting-source' && 'Right-click a component to start connection'}
            {manager.connectionStatus === 'selecting-target' && 'Right-click target component to complete connection'}
            {manager.connectionStatus === 'connected' && 'Connection created!'}
            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 'normal', color: '#666' }}>
              Press ESC to cancel
            </div>
          </div>
        </div>
      )}
    </div>
  )
}