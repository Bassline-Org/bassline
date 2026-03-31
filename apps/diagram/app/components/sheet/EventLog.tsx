import { Sheet } from '@bassline/sheet'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import type { SheetEvent } from '~/hooks/useSheet'

interface EventLogProps {
  sheet: Sheet
  events: SheetEvent[]
  onClear: () => void
}

function formatEvent(msg: SheetEvent, sheet: Sheet): string {
  switch (msg.type) {
    case 'error':
      return `${msg.message ?? 'unknown error'}`
    case 'set':
      return `set [${msg.r},${msg.c}] ${msg.id} = ${JSON.stringify(sheet.resolve(msg.id as string))}`
    case 'update':
      return `update ${msg.id} = ${JSON.stringify(msg.value)}`
    case 'link':
      return `link [${msg.r},${msg.c}] → ${msg.id}`
    case 'clear':
      return `clear [${msg.r},${msg.c}]`
    case 'gc':
      return `gc: ${(msg.collected as unknown[])?.length ?? 0} collected`
    case 'select':
      return `select "${msg.name}"`
    default:
      return JSON.stringify(msg)
  }
}

export function EventLog({ sheet, events, onClear }: EventLogProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs text-muted-foreground">{events.length} events</span>
        <Button size="xs" variant="ghost" onClick={onClear} className="text-xs h-5">
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-0.5 pb-2">
          {[...events].reverse().map((msg, i) => (
            <div
              key={events.length - 1 - i}
              className={`text-xs font-mono py-0.5 border-b border-border/30 ${msg.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              <span className="text-[hsl(199,92%,64%)]">{msg.type}</span> {formatEvent(msg, sheet)}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
