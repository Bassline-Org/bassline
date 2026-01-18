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
  rt.def('.nodes', graph => [graph.nodes])
  rt.def('.edges', graph => [graph.edges])

  rt.def('.add-node', (props, graph) => {
    const node = {
      ...props,
      id: props.id || 'n' + (graph._nextId++),
      _graph: graph
    }
    graph.nodes.push(node)
    return [node]
  })

  rt.def('.get-node', (id, graph) => {
    return [graph.nodes.find(n => n.id === id) || null]
  })

  rt.def('.rm', node => {
    const graph = node._graph
    const nodeId = node.id
    graph.nodes = graph.nodes.filter(n => n.id !== nodeId)
    graph.edges = graph.edges.filter(e =>
      e.source !== nodeId && e.target !== nodeId
    )
  })

  // === Node Methods ===
  rt.def('.graph', node => [node._graph])

  // Note: .get and .set are already defined in core for streams
  // We extend them to work with nodes by checking if it's a node (has _graph)
  // Actually, we need different names to avoid collision - use property access pattern
  rt.def('.prop', (key, node) => [node[key]])
  rt.def('.prop!', (value, key, node) => { node[key] = value })

  rt.def('.outgoing', node => {
    const graph = node._graph
    const nodeId = node.id
    return [graph.edges
      .filter(e => e.source === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter(Boolean)]
  })

  rt.def('.incoming', node => {
    const graph = node._graph
    const nodeId = node.id
    return [graph.edges
      .filter(e => e.target === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.source))
      .filter(Boolean)]
  })

  // .connect ( label target node -- edge )
  rt.def('.connect', (label, target, node) => {
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

  // .disconnect ( target node -- )
  rt.def('.disconnect', (target, node) => {
    const graph = node._graph
    const targetId = typeof target === 'object' ? target.id : target
    graph.edges = graph.edges.filter(e =>
      !(e.source === node.id && e.target === targetId)
    )
  })

  // === Traversal ===
  // .traverse ( quot node -- )
  rt.def('.traverse', async (quot, node) => {
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
