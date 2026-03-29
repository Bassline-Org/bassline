import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { EdgeData } from '~/db/queries'

function LineEdge(props: EdgeProps<Edge<EdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props
  const { label, ontologies } = data ?? {}

  const color = ontologies?.[0]?.color ?? '#9ca3af'

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      {label && (
        <text x={labelX} y={labelY - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {label}
        </text>
      )}
    </>
  )
}

export default memo(LineEdge)
