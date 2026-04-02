export function wire(elements, nodes) {
  const labels = new Map()
  for (const el of elements) {
    if (!el.data.source) labels.set(el.data.id, el.data.label || el.data.id)
  }
  for (const el of elements) {
    if (!el.data.source) continue
    const src = nodes[labels.get(el.data.source)]
    const tgt = nodes[labels.get(el.data.target)]
    if (src && tgt) src.to(tgt.send)
  }
}