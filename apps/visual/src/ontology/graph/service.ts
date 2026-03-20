import { net, consume } from '@bassline/core'
import { store } from './store'
import { isGraphMutationMsg, type GraphWriteMsg, type ResultMsg } from './messages'
import type { Entry } from '../storage/messages'

type GraphMsg = GraphWriteMsg | ResultMsg

type GraphServiceOptions = {
  history?: Entry[]
  persist?: (entry: Entry) => void
  debug?: (msg: unknown) => void
}

export function createGraphService({ history = [], persist = () => {}, debug = () => {} }: GraphServiceOptions = {}) {
  const graphNet = net<GraphMsg>()

  const slot = graphNet()
  const state = store({ recv: slot.recv as any, send: slot.send })
  let head: string | null = null

  for (const entry of history) {
    const { msg, id } = entry
    if (!isGraphMutationMsg(msg)) {
      debug({ type: 'warn', source: 'graph.service', body: 'skipping invalid graph history entry', context: { entry } })
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
