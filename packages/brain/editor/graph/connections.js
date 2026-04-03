import { cy } from './graph.js'

export const eh = cy.edgehandles({
  canConnect: (s, t) => {
    switch (true) {
      case s.data?.type === 'type':
      case s.same(t):
      case s.edgesTo(t).length > 0:
        return false
      default:
        return true
    }
  },
  edgeParams: (src, tgt) => ({
    data: { id: `${src.id()}->${tgt.id()}` },
  }),
})

cy.on('tapstart', 'node', e => {
  if (e.originalEvent?.ctrlKey) {
    e.target.ungrabify()
    eh.start(e.target)
  }
})

cy.on('ehcomplete ehstop', () => {
  cy.nodes().grabify()
})
