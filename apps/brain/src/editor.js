import { cy, eh, save } from './graph.js'

const uid = () => crypto.randomUUID()

// --- Ctrl+drag to draw edges ---

cy.on('tapstart', 'node', (e) => {
  if (e.originalEvent?.ctrlKey) {
    e.target.ungrabify()
    eh.start(e.target)
  }
})

cy.on('ehcomplete ehstop', () => {
  cy.nodes().grabify()
})

// --- context menus ---

cy.cxtmenu({
  selector: 'core',
  commands: [
    {
      content: 'Add Node',
      select: (_, ev) => {
        const id = uid()
        cy.add({
          data: { id, label: id },
          position: ev.position,
        })
      },
    },
    {
      content: 'Save',
      select: () => save(),
    },
  ],
})

cy.cxtmenu({
  selector: 'node',
  commands: [
    {
      content: 'Rename',
      select: (ele) => {
        const name = prompt('Name:', ele.data('label'))
        if (name != null) ele.data('label', name)
      },
    },
    {
      content: 'Delete',
      select: (ele) => ele.remove(),
    },
  ],
})

cy.cxtmenu({
  selector: 'edge',
  commands: [
    {
      content: 'Delete',
      select: (ele) => ele.remove(),
    },
  ],
})

// --- keyboard ---

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    cy.$(':selected').remove()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
})
