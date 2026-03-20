import { net, nullWriter } from '@bassline/core'
import type { Reader, Writer } from '@bassline/core'
import { graph } from './messages'
import { store } from './store'
import { isGraphMutationMsg, isGraphWriteMsg, type GraphReadMsg, type GraphWriteMsg } from './shapes'
import type { Entry } from '../storage/messages'

type Warn = (message: string, context?: unknown) => void
type GraphMsg = GraphReadMsg | GraphWriteMsg

type GraphServiceOptions = {
  history?: Entry[]
  persist?: Writer<Entry>
  warn?: Warn
}

const storeState = ([r, w]: [Reader, Writer]) => store([r.filter(isGraphWriteMsg), w])

export function createGraphService({
  history = [],
  persist = nullWriter(),
  warn = console.warn,
}: GraphServiceOptions = {}) {
  const graphNet = net<GraphMsg>()
  const state = storeState(graphNet.join())
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

  const [r] = graphNet.join()
  r.filter(isGraphMutationMsg)
    .map(msg => {
      const entry: Entry = {
        id: crypto.randomUUID(),
        space: 'graph',
        key: 'ops',
        msg,
        prev: head,
      }
      head = entry.id
      return entry
    })
    .sink(persist)

  return graphNet
}

export function seedDefaultGraph(writer: Writer<GraphWriteMsg>) {
  const g = graph(writer)
  g.addNode('n1')
  g.position('n1', 100, 150)
  g.label('n1', 'Hello')
  g.addNode('n2')
  g.position('n2', 350, 200)
  g.label('n2', 'World')
}
