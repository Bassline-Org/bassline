import cytoscape from 'cytoscape'
import { propagator } from '@bassline/core'
import { reply, err, ok, warn, addNode } from './lib.js'

export function createDaemonProps(config = {}) {
  const graph = cytoscape({ headless: true })

  const bus = propagator(msg => {
    handleAdd(graph, msg)
    handleSend(graph, msg)
    handleSelect(graph, msg)
  })

  // node for the daemon
  addNode(graph, {
    id: '$daemon',
    type: 'daemon',
    name: config.name || 'daemon',
  })

  // nodes for the factories
  for (const [name, factory] of Object.entries(config.types)) {
    addNode(graph, { id: name, name, type: 'type' }).scratch('factory', factory)
  }

  return [bus, graph]
}

// ================
// daemon handlers
// ================

function handleAdd(graph, msg) {
  const { $type, type, wires = [] } = msg

  if ($type !== 'add') return

  const typeNode = graph.$id(type)

  if (!typeNode.length || typeNode.data('type') !== 'type') {
    reply(msg, err('add', `unknown type: ${type}`))
    return
  }

  const factory = typeNode.scratch('factory')

  if (!factory) {
    reply(msg, err('add', `type: ${type} doesn't have a factory function`))
    return
  }

  const id = msg.id || crypto.randomUUID()
  const instance = addNode(graph, {
    id,
    type: msg.type,
    label: msg.label || id,
  })
  const prop = factory(instance.data(), graph)
  instance.scratch('propagator', prop)

  for (const targetId of wires) {
    const target = graph.$id(targetId)
    if (!target.length) {
      reply(msg, warn('add', `no target: ${targetId}`))
      continue
    }
    const targetProp = target.scratch('propagator')
    if (!targetProp) {
      reply(msg, warn('add', `target: ${targetId} not live`))
      continue
    }
    prop.to(targetProp.send)
    graph.add({ group: 'edges', data: { source: id, target: targetId } })
  }
  reply(msg, ok('add', { id }))
}

function handleSend(graph, msg) {
  const { $type, body = {}, to } = msg
  if ($type !== 'send') return

  const target = graph.$id(to)
  if (!target.length) {
    reply(msg, err('send', `unknown target: ${to}`))
    return
  }

  const prop = target.scratch('propagator')
  if (!prop) {
    reply(msg, err('send', `not live: ${to}`))
    return
  }

  prop.send(body)
  reply(msg, ok('send', { to }))
}

function handleSelect(graph, msg) {
  const { $type, selector = '*' } = msg
  if ($type !== 'select') return
  const sel = graph.$(selector)
  reply(msg, { $type: 'result', result: sel.jsons() })
}
