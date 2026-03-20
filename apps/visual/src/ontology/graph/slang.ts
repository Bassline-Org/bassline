import { graph } from './messages'

export function graphView(send: (...args: any[]) => void) {
  const g = graph(send)
  return {
    ...g,
    addNode: (id: string, kind = 'default') => g.assert(id, 'kind', kind),
    position: (id: string, x: number, y: number) => g.assert(id, 'position', { x, y }),
    dimensions: (id: string, w: number, h: number) => g.assert(id, 'dimensions', { w, h }),
    label: (id: string, text: string) => g.assert(id, 'label', text),
    connect: (id: string, source: string, target: string) => {
      g.assert(id, 'kind', 'edge')
      g.assert(id, 'source', source)
      g.assert(id, 'target', target)
    },
    remove: (id: string) => g.retract(id, null),
  } as const
}

export function seedDefaultGraph(send: (...args: any[]) => void) {
  const g = graphView(send)
  g.addNode('n1')
  g.position('n1', 100, 150)
  g.label('n1', 'Hello')
  g.addNode('n2')
  g.position('n2', 350, 200)
  g.label('n2', 'World')
}
