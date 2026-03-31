import { Sheet } from '@bassline/sheet'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'

interface ValuesPanelProps {
  sheet: Sheet
  version: number
}

export function ValuesPanel({ sheet, version }: ValuesPanelProps) {
  void version
  const values = [...sheet.values.entries()]

  if (values.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">No values yet</div>
  }

  return (
    <ScrollArea className="max-h-[200px]">
      <div className="p-3 space-y-1">
        {values.map(([vid, val]) => {
          // Count references
          let refCount = 0
          for (const [, cellVid] of sheet.cells) {
            if (cellVid === vid) refCount++
          }

          return (
            <div key={vid} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[hsl(199,92%,64%)] min-w-[60px] cursor-pointer" title="Click to edit">
                {vid}
              </span>
              <span className="flex-1 truncate">{JSON.stringify(val)}</span>
              <span className="text-muted-foreground">{refCount}ref</span>
              <Button
                size="xs"
                variant="ghost"
                className="h-5 px-1 text-xs"
                onClick={() => {
                  const nv = prompt(`Update value ${vid}:`, String(val))
                  if (nv == null) return
                  const num = Number(nv)
                  sheet.update(vid, isNaN(num) || nv.trim() === '' ? nv : num)
                }}
              >
                edit
              </Button>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
