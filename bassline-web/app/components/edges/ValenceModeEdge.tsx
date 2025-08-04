import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import { useEditorModes } from '~/propagation-react/hooks/useURLState'

export const ValenceModeEdge = memo((props: EdgeProps) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, markerStart, style } = props
  const { currentMode } = useEditorModes()
  
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  
  // In valence mode, dim all edges since they're not part of the connection process
  const isDimmed = currentMode === 'valence'
  
  return (
    <path
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={{
        ...style,
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 0.2s'
      }}
    />
  )
})

ValenceModeEdge.displayName = 'ValenceModeEdge'