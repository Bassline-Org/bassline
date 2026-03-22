import { DirectedGraph, MultiDirectedGraph } from 'graphology'
import { port, consume } from '@bassline/core'
import type { Recv } from '@bassline/core'

export function edits(send: (edit: GraphEdit) => void) {
  return {
    node: (node: string, attributes: Attrs = {}) =>
      send({
        type: 'graph.update.node',
        node,
        attributes,
      }),
    edge: (source: string, target: string, attributes: Attrs = {}) =>
      send({
        type: 'graph.update.edge',
        source,
        target,
        attributes,
      }),
    removeNode: (node: string) =>
      send({
        type: 'graph.remove.node',
        node,
      }),
    removeEdge: (source: string, target: string) =>
      send({
        type: 'graph.remove.edge',
        source,
        target,
      }),
  }
}

export function mutator(recv: Recv<GraphEdit>, graph: DirectedGraph): Promise<void> {
  const edgeKey = (source: string, target: string) => `${source}->${target}`
  const task = consume(recv, msg => {
    switch (msg?.type) {
      case 'graph.update.node': {
        const { node, attributes } = msg
        graph.mergeNode(node, attributes)
        break
      }
      case 'graph.remove.node': {
        graph.dropNode(msg.node)
        break
      }
      case 'graph.update.edge': {
        const { source, target, attributes } = msg
        const key = edgeKey(source, target)
        graph.mergeDirectedEdgeWithKey(key, source, target, attributes)
        break
      }
      case 'graph.remove.edge': {
        const { source, target } = msg
        const key = edgeKey(source, target)
        graph.dropEdge(key)
        break
      }
      default:
        break
    }
  })

  return task
}

async function example() {
  const { send, recv, close } = port<GraphEdit>()

  const graph = new MultiDirectedGraph()
  const task = mutator(recv, graph)
  const log = () => {
    for (const node of graph.nodeEntries()) {
      console.log(node)
    }
    for (const edge of graph.edgeEntries()) {
      console.log(edge)
    }
  }
  const edit = edits(send)

  edit.node('foo', { a: 123 })
  edit.node('bar')
  edit.edge('foo', 'bar', { some: 'property' })

  await new Promise(res => setTimeout(res, 100))

  console.log('graph')
  log()

  console.log(graph.toJSON())

  edit.removeNode('foo')

  await new Promise(res => setTimeout(res, 100))

  console.log('after trim')
  log()

  edit.node('bar', { another: 'thing' })

  await new Promise(res => setTimeout(res, 100))

  close()
  await task

  console.log('after ')
  log()
}

await example()

export type GraphEdit = Update | Remove
type Attrs = Record<string, unknown>
type Update =
  | {
      type: 'graph.update.node'
      node: string
      attributes: Attrs
    }
  | {
      type: 'graph.update.edge'
      source: string
      target: string
      attributes: Attrs
    }

type Remove =
  | {
      type: 'graph.remove.node'
      node: string
    }
  | {
      type: 'graph.remove.edge'
      source: string
      target: string
    }
