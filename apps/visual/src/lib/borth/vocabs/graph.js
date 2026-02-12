// graph vocab - Property graph operations
import { Vocab } from '../primitives.js'

export function createGraphVocab(rt) {
  const vocab = new Vocab('graph')
  const saved = rt.current
  rt.current = vocab

  // === Graph Creation ===
  rt.def('<graph>', () => [{
    nodes: [],
    edges: [],
    _nextId: 1
  }])

  // === Graph Methods ===
  // Convention: subject (graph/node) is first param (deepest in stack)

  rt.def('.nodes', graph => [graph.nodes])
  rt.def('.edges', graph => [graph.edges])

  // .add-node ( graph props -- node )
  rt.def('.add-node', (graph, props) => {
    const node = {
      ...props,
      id: props.id || 'n' + (graph._nextId++),
      _graph: graph
    }
    graph.nodes.push(node)
    return [node]
  })

  // .get-node ( graph id -- node|nil )
  rt.def('.get-node', (graph, id) => {
    return [graph.nodes.find(n => n.id === id) || null]
  })

  // .rm ( node -- )
  rt.def('.rm', node => {
    const graph = node._graph
    const nodeId = node.id
    graph.nodes = graph.nodes.filter(n => n.id !== nodeId)
    graph.edges = graph.edges.filter(e =>
      e.source !== nodeId && e.target !== nodeId
    )
  })

  // === Node Methods ===

  // .graph ( node -- graph )
  rt.def('.graph', node => [node._graph])

  // .prop ( node key -- value )
  rt.def('.prop', (node, key) => [node[key]])

  // .prop! ( node key value -- )
  rt.def('.prop!', (node, key, value) => { node[key] = value })

  // .outgoing ( node -- nodes )
  rt.def('.outgoing', node => {
    const graph = node._graph
    const nodeId = node.id
    return [graph.edges
      .filter(e => e.source === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter(Boolean)]
  })

  // .incoming ( node -- nodes )
  rt.def('.incoming', node => {
    const graph = node._graph
    const nodeId = node.id
    return [graph.edges
      .filter(e => e.target === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.source))
      .filter(Boolean)]
  })

  // .connect ( node target label -- edge )
  rt.def('.connect', (node, target, label) => {
    const graph = node._graph
    const edge = {
      id: 'e' + (graph._nextId++),
      source: node.id,
      target: typeof target === 'object' ? target.id : target,
      label
    }
    graph.edges.push(edge)
    return [edge]
  })

  // .disconnect ( node target -- )
  rt.def('.disconnect', (node, target) => {
    const graph = node._graph
    const targetId = typeof target === 'object' ? target.id : target
    graph.edges = graph.edges.filter(e =>
      !(e.source === node.id && e.target === targetId)
    )
  })

  // === Traversal ===

  // .traverse ( node quot -- )
  rt.def('.traverse', async (node, quot) => {
    const graph = node._graph
    const seen = new Set()
    const queue = [node.id]

    while (queue.length > 0) {
      const nodeId = queue.shift()
      if (seen.has(nodeId)) continue
      seen.add(nodeId)

      const current = graph.nodes.find(n => n.id === nodeId)
      if (!current) continue

      await rt.runFresh(quot, current)

      // Queue outgoing neighbors
      for (const edge of graph.edges) {
        if (edge.source === nodeId && !seen.has(edge.target)) {
          queue.push(edge.target)
        }
      }
    }
  })

  rt.current = saved
  return vocab
}
