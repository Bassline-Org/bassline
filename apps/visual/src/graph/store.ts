import type { Reader, Writer } from '@bassline/core'
import { graph } from './messages'
import type { GraphWriteMsg } from './shapes'
import { createGraphState } from './state'

export function store([reader, writer]: [Reader<GraphWriteMsg>, Writer]) {
  const g = graph(writer)
  const state = createGraphState()

  reader.sink((msg: GraphWriteMsg) => {
    switch (msg.type) {
      case 'assert':
        state.apply(msg)
        break
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
