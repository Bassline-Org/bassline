import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useSheet } from '~/hooks/useSheet'
import { SheetGrid, type SelectionRange } from '~/components/sheet/SheetGrid'
import { CellInspector } from '~/components/sheet/CellInspector'
import { SelectionsPanel } from '~/components/sheet/SelectionsPanel'
import { ValuesPanel } from '~/components/sheet/ValuesPanel'
import { EventLog } from '~/components/sheet/EventLog'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { exportSheet } from '~/lib/persistence'

export default function SheetRoute() {
  const { name } = useParams<{ name: string }>()
  if (!name) return <div>No sheet name</div>

  const { sheet, commands, version, events, clearEvents, addError, ready } = useSheet(name)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const [currentRange, setCurrentRange] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  if (!ready || !sheet || !commands) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex h-screen">
      {/* Grid area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
          <Link to="/" className="text-muted-foreground hover:text-foreground text-sm">
            &larr;
          </Link>
          <h1 className="text-sm font-medium">{name}</h1>
          <span className="text-xs text-muted-foreground">
            {sheet.cells.size} cells &middot; {sheet.values.size} values
          </span>
          <div className="flex-1" />
          <Button size="xs" variant="outline" onClick={() => sheet.gc()}>
            GC
          </Button>
          <Button size="xs" variant="outline" onClick={() => exportSheet(sheet, `${name}.json`)}>
            Export
          </Button>
        </div>
        <div className="flex-1 relative">
          <SheetGrid
            sheet={sheet}
            commands={commands}
            version={version}
            onCursorChange={(r, c) => setCursor([r, c])}
            onSelectionRangeChange={setCurrentRange}
            onError={addError}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-[320px] border-l border-border bg-card flex flex-col">
        <ScrollArea className="flex-1">
          <div className="border-b border-border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Cell Inspector
            </div>
            <CellInspector sheet={sheet} cursor={cursor} version={version} />
          </div>

          <div className="border-b border-border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Selections
            </div>
            <SelectionsPanel sheet={sheet} version={version} currentRange={currentRange} />
          </div>

          <div className="border-b border-border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Values Store
            </div>
            <ValuesPanel sheet={sheet} version={version} />
          </div>

          <div className="border-b border-border max-h-[250px] flex flex-col">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Event Log
            </div>
            <EventLog sheet={sheet} events={events} onClear={clearEvents} />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
