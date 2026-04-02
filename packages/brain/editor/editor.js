import { cy, eh, save } from './graph.js'

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
        cy.add({
          data: { id: crypto.randomUUID(), label: '', type: '', live: true },
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
        const name = prompt('Label:', ele.data('label'))
        if (name != null) ele.data('label', name)
      },
    },
    {
      content: 'Set Type',
      select: (ele) => {
        const type = prompt('Type:', ele.data('type'))
        if (type != null) ele.data('type', type)
      },
    },
    {
      content: 'Toggle Live',
      select: (ele) => ele.data('live', !ele.data('live')),
    },
    {
      content: 'Edit Data',
      select: (ele) => {
        const json = prompt('Data (JSON):', JSON.stringify(ele.data()))
        if (json == null) return
        try {
          const data = JSON.parse(json)
          ele.data(data)
        } catch (e) {
          alert('Invalid JSON')
        }
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
