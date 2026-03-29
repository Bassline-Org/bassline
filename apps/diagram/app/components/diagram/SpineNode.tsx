import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { NodeData } from '~/db/queries'

function SpineNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { label, ontologies, marks, handles } = data

  const primaryColor = ontologies?.[0]?.color ?? null
  const hasHandles = handles && handles.length > 0

  return (
    <div
      className="rounded-lg bg-card min-w-[100px] relative"
      style={{
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderLeftWidth: primaryColor ? 4 : 2,
        borderStyle: 'solid',
        borderTopColor: selected ? 'var(--ring)' : 'var(--border)',
        borderRightColor: selected ? 'var(--ring)' : 'var(--border)',
        borderBottomColor: selected ? 'var(--ring)' : 'var(--border)',
        borderLeftColor: primaryColor ?? (selected ? 'var(--ring)' : 'var(--border)'),
      }}
    >
      {/* Handle rows */}
      {hasHandles ? (
        <div className="px-3 py-2 flex flex-col gap-1.5">
          {handles.map((h, i) => {
            const yPercent = `${((i + 1) / (handles.length + 1)) * 100}%`
            return (
              <div key={h.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/60">&bull;</span>
                {h.name}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={h.id}
                  style={{ top: yPercent }}
                  className="w-2! h-2! min-w-0! min-h-0! rounded-sm! bg-primary/50! border! border-primary/80! hover:bg-primary! -left-[5px]!"
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={h.id}
                  style={{ top: yPercent }}
                  className="w-2! h-2! min-w-0! min-h-0! rounded-sm! bg-primary/50! border! border-primary/80! hover:bg-primary! -right-[5px]!"
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-3 py-2 text-[11px] text-muted-foreground/40 italic">
          no handles
          <Handle
            type="target"
            position={Position.Left}
            id="__fallback"
            className="w-2! h-2! min-w-0! min-h-0! rounded-sm! bg-primary/50! border! border-primary/80! hover:bg-primary! -left-[5px]!"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="__fallback"
            className="w-2! h-2! min-w-0! min-h-0! rounded-sm! bg-primary/50! border! border-primary/80! hover:bg-primary! -right-[5px]!"
          />
        </div>
      )}

      {/* Label */}
      {label && (
        <div className="px-3 pb-2 text-xs font-medium text-foreground border-t border-border/50 pt-1">{label}</div>
      )}

      {/* Marks */}
      {marks && marks.length > 0 && (
        <div className="px-3 pb-1 flex gap-1 text-[10px] text-muted-foreground">
          {marks.map(m => (
            <span key={m} title={m} className="bg-muted px-1 rounded">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(SpineNode)
