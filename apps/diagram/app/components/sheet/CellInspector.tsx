import { useState } from 'react'
import { Sheet } from '@bassline/sheet'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface CellInspectorProps {
  sheet: Sheet
  cursor: [number, number] | null
  version: number
}

export function CellInspector({ sheet, cursor, version }: CellInspectorProps) {
  const [linkId, setLinkId] = useState('')

  if (!cursor) {
    return <div className="p-3 text-sm text-muted-foreground">Click a cell to inspect</div>
  }

  void version
  const [row, col] = cursor
  const value = sheet.get([row, col])
  const vid = sheet.ref([row, col])

  // Find which selections contain this cell
  const containingSelections: string[] = []
  for (const [name, region] of sheet.selections) {
    if (
      region?.r &&
      region?.c &&
      row >= region.r[0] &&
      row <= region.r[1] &&
      col >= region.c[0] &&
      col <= region.c[1]
    ) {
      containingSelections.push(name)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Position</span>
        <span className="font-mono">
          [{row}, {col}]
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Value</span>
        <span className="font-mono">{value != null ? JSON.stringify(value) : '(empty)'}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">ID</span>
        <span className="font-mono text-[hsl(199,92%,64%)]">{vid ?? '(none)'}</span>
      </div>

      {containingSelections.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">In</span>
          <div className="flex gap-1 flex-wrap">
            {containingSelections.map(name => (
              <span key={name} className="px-1.5 py-0.5 bg-accent/20 text-accent-foreground rounded text-xs">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="xs" variant="outline" onClick={() => sheet.clear([row, col])}>
          Clear
        </Button>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Link to value ID</label>
        <div className="flex gap-2">
          <Input
            value={linkId}
            onChange={e => setLinkId(e.target.value)}
            placeholder="value ID"
            className="h-7 text-xs font-mono"
          />
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              if (!linkId.trim()) return
              if (sheet.resolve(linkId.trim()) == null) return
              sheet.link([row, col], linkId.trim())
              setLinkId('')
            }}
          >
            Link
          </Button>
        </div>
      </div>
    </div>
  )
}
