import React from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { getValueThickness } from '~/propagation-core/utils/value-detection'

export function FatEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
  ...props
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Get thickness based on data
  const thickness = (data?.thickness as number) || 1
  const isFat = thickness > 1
  
  // Create gradient ID unique to this edge
  const gradientId = `gradient-${id}`
  
  // Determine gradient colors based on thickness/type
  const getGradientColors = () => {
    if (!isFat) return null
    
    // Use different color schemes for different thicknesses
    if (thickness >= 4) {
      // Very fat - rainbow/RGB braided effect
      return ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd']
    } else if (thickness >= 3) {
      // Medium fat - three color gradient
      return ['#667eea', '#764ba2', '#f093fb']
    } else {
      // Slightly fat - two color gradient
      return ['#667eea', '#764ba2']
    }
  }
  
  const gradientColors = getGradientColors()
  const baseStrokeWidth = (style.strokeWidth as number) || 2
  const strokeWidth = baseStrokeWidth // Don't double-scale since thickness is already in style
  
  return (
    <>
      {isFat && gradientColors && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {gradientColors.map((color, index) => (
              <stop
                key={index}
                offset={`${(index / (gradientColors.length - 1)) * 100}%`}
                stopColor={color}
                stopOpacity={style.opacity || 1}
              />
            ))}
          </linearGradient>
        </defs>
      )}
      
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          ...style,
          stroke: isFat && gradientColors ? `url(#${gradientId})` : style.stroke,
          strokeWidth,
        }}
      />
      
      {/* Add subtle pattern overlay for fat edges */}
      {thickness >= 3 && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth * 0.4}
          strokeDasharray="2,4"
          strokeLinecap="round"
          style={{
            animation: 'dash 20s linear infinite',
          }}
        />
      )}
      
      {/* Add inner glow for very fat values */}
      {thickness >= 4 && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={strokeWidth * 0.2}
          style={{
            filter: 'blur(2px)',
          }}
        />
      )}
    </>
  )
}