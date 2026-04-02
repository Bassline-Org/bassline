export function build(elements, types) {
  const labels = new Map()
  const nodes = {}
  const seen = new Set()

  for (const el of elements) {
    if (el.data.source) continue
    const label = el.data.label || el.data.id
    labels.set(el.data.id, label)
    if (!el.data.live) continue
    if (seen.has(label)) throw new Error(`Duplicate live node label: "${label}"`)
    seen.add(label)
    const factory = types[el.data.type]
    if (!factory) throw new Error(`No factory for type "${el.data.type}" on node "${label}"`)
    nodes[label] = factory(el.data, elements)
  }

  for (const el of elements) {
    if (!el.data.source) continue
    const src = nodes[labels.get(el.data.source)]
    const tgt = nodes[labels.get(el.data.target)]
    if (src && tgt) src.to(tgt.send)
  }

  return nodes
}
