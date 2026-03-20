import { graphView } from './slang'
import type { XyflowEvent } from './types'

export function bridgeToGraph(send: (msg: unknown) => void): (event: XyflowEvent) => void {
  const g = graphView(send)
  return (event: XyflowEvent) => {
    switch (event.kind) {
      case 'nodesChange':
        for (const c of event.changes) {
          if (c.type === 'position' && c.position && !c.dragging) {
            g.position(c.id, c.position.x, c.position.y)
          }
        }
        break
      case 'connect':
        g.connect(event.id, event.connection.source, event.connection.target)
        break
      case 'delete':
        for (const n of event.nodes) g.remove(n.id)
        for (const e of event.edges) g.remove(e.id)
        break
    }
  }
}
