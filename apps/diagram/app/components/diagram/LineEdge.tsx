import { memo } from 'react'
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import type { ReactFlowEdge } from '~/db/queries'

function LineEdge(props: EdgeProps<ReactFlowEdge>) {
  const { sourceX, sourceY, targetX, targetY, data, selected } = props
  const { label, ontologies } = data ?? {}

  const color = ontologies?.[0]?.color ?? '#9ca3af'

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
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
