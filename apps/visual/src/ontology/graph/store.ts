import { consume } from '@bassline/core'
import type { EOF } from '@bassline/core'
import { graph } from './slang'
import type { GraphWriteMsg } from './schema'
import { createGraphState } from './state'

export function store({
  recv,
  send,
}: {
  recv: () => Promise<GraphWriteMsg | typeof EOF>
  send: (...args: any[]) => void
}) {
  const g = graph(send)
  const state = createGraphState()

  consume(recv, (msg: GraphWriteMsg) => {
    switch (msg.type) {
      case 'assert':
      case 'retract':
        state.apply(msg)
        break
      case 'query':
        g.result(msg.qid, state.query(msg.s, msg.p, msg.o))
        break
    }
  })

  return state
}
