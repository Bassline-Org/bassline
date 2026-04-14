import { hasCap } from '@bassline/core'

const REPLY = Symbol.for('reply')

export function reply(msg, response) {
  if (!hasCap(msg, REPLY)) return
  msg[REPLY](response)
}

export function withReply(msg, send) {
  return { ...msg, [REPLY]: send }
}

export const err = (re, msg) => ({ $type: 'error', re, msg })
export const ok = (re, data = {}) => ({ $type: 'ok', re, ...data })
export const warn = (re, msg) => ({ $type: 'warning', re, msg })

export function addNode(graph, data) {
  return graph.add({
    group: 'nodes',
    data: { ...data, id: data.id ?? crypto.randomUUID() },
  })
}
