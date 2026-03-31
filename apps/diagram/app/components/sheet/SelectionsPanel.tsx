import { useState } from 'react'
import { Sheet } from '@bassline/sheet'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface SelectionsPanelProps {
  sheet: Sheet
  version: number
  currentRange?: { x: number; y: number; width: number; height: number } | null
}

export function SelectionsPanel({ sheet, version, currentRange }: SelectionsPanelProps) {
  const [newName, setNewName] = useState('')

  void version
  const selections = [...sheet.selections.entries()].filter(([name]) => !name.startsWith('_'))

  const saveSelection = () => {
    const name = newName.trim()
    if (!name || !currentRange) return
    sheet.select(name, {
      r: [currentRange.y, currentRange.y + currentRange.height - 1],
      c: [currentRange.x, currentRange.x + currentRange.width - 1],
    })
    setNewName('')
  }

  return (
    <div className="space-y-2 p-3">
      {currentRange && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="selection name"
            className="h-7 text-xs"
            onKeyDown={e => e.key === 'Enter' && saveSelection()}
          />
          <Button size="xs" variant="outline" onClick={saveSelection}>
            Save
          </Button>
        </div>
      )}

      {selections.length === 0 && (
        <div className="text-xs text-muted-foreground">No selections. Drag to select a range, then name it.</div>
      )}

      {selections.map(([name, region]) => {
        const meta = Object.entries(region)
          .filter(([k]) => k !== 'r' && k !== 'c')
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')

        return (
          <div key={name} className="flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-medium text-[hsl(120,38%,65%)]">{name}</span>
              <span className="ml-2 text-muted-foreground font-mono">
                r[{region.r?.[0]},{region.r?.[1]}] c[{region.c?.[0]},{region.c?.[1]}]
              </span>
              {meta && <span className="ml-2 text-muted-foreground">{meta}</span>}
            </div>
            <Button
              size="xs"
              variant="ghost"
              className="h-5 w-5 p-0 text-destructive"
              onClick={() => {
                sheet.selections.delete(name)
                // Trigger re-render by setting a dummy selection and deleting it
                ;(sheet as any)._emit({ type: 'select', name, region: null })
              }}
            >
              x
            </Button>
          </div>
        )
      })}
    </div>
  )
}
