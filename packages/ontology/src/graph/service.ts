import { net, consume } from '@bassline/core'
import { store } from './store.js'
import { isGraphMutationMsg, type GraphMutationMsg, type GraphWriteMsg, type ResultMsg } from './schema.js'

type GraphMsg = GraphWriteMsg | ResultMsg

type GraphServiceOptions = {
  history?: GraphMutationMsg[]
  persist?: (mutation: GraphMutationMsg) => void
  debug?: (msg: unknown) => void
}

export function createGraphService({ history = [], persist = () => {}, debug = () => {} }: GraphServiceOptions = {}) {
  const graphNet = net<GraphMsg>()

  const slot = graphNet()
  const state = store({ recv: slot.recv as any, send: slot.send })

  for (const mutation of history) {
    if (!isGraphMutationMsg(mutation)) {
      debug({ type: 'warn', source: 'graph.service', body: 'skipping invalid history entry', context: { mutation } })
      continue
    }
    state.apply(mutation)
  }

  const watcher = graphNet()
  consume(watcher.recv, msg => {
    if (isGraphMutationMsg(msg)) {
      persist(msg as GraphMutationMsg)
    }
  })

  return graphNet
}
