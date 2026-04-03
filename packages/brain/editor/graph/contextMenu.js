import { cy, persist } from './graph.js'

const cmd = (label, onSelect) => ({ content: label, select: onSelect })

const addNode = cmd('Add Node', (_, ev) =>
  cy.add({
    group: 'nodes',
    data: { id: crypto.randomUUID(), label: '', type: '', live: true },
    position: ev.position,
  })
)

const format = cmd('Format', () => {
  cy.layout({ name: 'tidytree', direction: 'LR' }).run()
})

const save = cmd('Save', persist.save)

const remove = cmd('Remove', ele => ele.remove())

cy.cxtmenu({
  selector: 'core',
  commands: [addNode, format, save],
  outsideMenuCancel: 50,
})

cy.cxtmenu({
  selector: 'node',
  commands: [remove],
})

cy.cxtmenu({
  selector: 'edge',
  commands: [remove],
})
