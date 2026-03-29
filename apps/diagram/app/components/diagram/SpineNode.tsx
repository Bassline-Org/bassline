import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

type HandleInfo = { id: string; role: 'source' | 'target' }

type SpineData = {
  label: string | null
  ontologies: { name: string; color: string | null }[]
  marks: string[]
  expanded: boolean
  handles: HandleInfo[]
}

const MARK_SYMBOLS: Record<string, string> = {
  attests: '🔑',
  persists: '💾',
  transforms: '⚡',
  filters: '🔍',
}

// Distribute handles evenly around the spine
function layoutHandles(handles: HandleInfo[]) {
  const sources = handles.filter(h => h.role === 'source')
  const targets = handles.filter(h => h.role === 'target')

  const positions = [Position.Top, Position.Right, Position.Bottom, Position.Left]
  const result: { id: string; type: 'source' | 'target'; position: Position }[] = []

  // Targets get first available positions, sources get the rest
  let posIdx = 0
  for (const h of targets) {
    result.push({ id: h.id, type: 'target', position: positions[posIdx % positions.length] })
    posIdx++
  }
  for (const h of sources) {
    result.push({ id: h.id, type: 'source', position: positions[posIdx % positions.length] })
    posIdx++
  }

  return result
}

function SpineNode({ data, selected }: NodeProps) {
  const { label, ontologies, marks, handles } = data as unknown as SpineData

  const primaryColor = ontologies?.[0]?.color ?? '#9ca3af'
  const hasMultiple = ontologies?.length > 1

  const layoutedHandles = layoutHandles(handles ?? [])

  // If no handles from DB, provide one source and one target so new connections work
  const hasAnyHandle = layoutedHandles.length > 0

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Dynamic handles from DB */}
      {layoutedHandles.map(h => (
        <Handle
          key={`${h.type}-${h.id}`}
          type={h.type}
          position={h.position}
          id={h.id}
          className="w-2! h-2! min-w-0! min-h-0! rounded-full! bg-muted-foreground/40! border-none! hover:bg-primary!"
        />
      ))}

      {/* Fallback handles for unconnected spines */}
      {!hasAnyHandle && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="target:default"
            className="w-2! h-2! min-w-0! min-h-0! rounded-full! bg-muted-foreground/40! border-none! hover:bg-primary!"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source:default"
            className="w-2! h-2! min-w-0! min-h-0! rounded-full! bg-muted-foreground/40! border-none! hover:bg-primary!"
          />
        </>
      )}

      {/* The spine dot */}
      <div
        className="rounded-full transition-shadow"
        style={{
          width: 28,
          height: 28,
          backgroundColor: primaryColor,
          border: selected ? '3px solid var(--ring)' : '2px solid rgba(0,0,0,0.15)',
          boxShadow: selected ? '0 0 0 2px var(--ring)' : 'none',
          background: hasMultiple
            ? `conic-gradient(${ontologies.map((o, i) => `${o.color ?? '#9ca3af'} ${(i / ontologies.length) * 360}deg ${((i + 1) / ontologies.length) * 360}deg`).join(', ')})`
            : primaryColor,
        }}
      />

      {/* Mark icons */}
      {marks?.length > 0 && (
        <div className="flex gap-0.5 text-xs">
          {marks.map(m => (
            <span key={m} title={m}>
              {MARK_SYMBOLS[m] ?? '•'}
            </span>
          ))}
        </div>
      )}

      {/* Label */}
      {label && <div className="text-xs text-muted-foreground max-w-24 truncate text-center">{label}</div>}
    </div>
  )
}

export default memo(SpineNode)
