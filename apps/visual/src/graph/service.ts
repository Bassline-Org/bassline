import { net, consume } from '@bassline/core'
import { graph } from './messages'
import { store } from './store'
import { isGraphMutationMsg, type GraphWriteMsg } from './shapes'
import type { ResultMsg } from './messages'
import type { Entry } from '../storage/messages'

type Warn = (message: string, context?: unknown) => void
type GraphMsg = GraphWriteMsg | ResultMsg

type GraphServiceOptions = {
  history?: Entry[]
  persist?: (entry: Entry) => void
  warn?: Warn
}

export function createGraphService({
  history = [],
  persist = () => {},
  warn = console.warn,
}: GraphServiceOptions = {}) {
  const graphNet = net<GraphMsg>()

  const slot = graphNet()
  const state = store({ recv: slot.recv as any, send: slot.send })
  let head: string | null = null

  for (const entry of history) {
    const { msg, id } = entry
    if (!isGraphMutationMsg(msg)) {
      warn('graph.service: skipping invalid graph history entry', { entry })
      continue
    }
    state.apply(msg)
    head = id
  }

  const watcher = graphNet()
  consume(watcher.recv, msg => {
    if (isGraphMutationMsg(msg)) {
      const entry: Entry = {
        id: crypto.randomUUID(),
        space: 'graph',
        key: 'ops',
        msg,
        prev: head,
      }
      head = entry.id
      persist(entry)
    }
  })

  return graphNet
}

export function seedDefaultGraph(send: (...args: any[]) => void) {
  const g = graph(send)
  g.addNode('n1')
  g.position('n1', 100, 150)
  g.label('n1', 'Hello')
  g.addNode('n2')
  g.position('n2', 350, 200)
  g.label('n2', 'World')
}
