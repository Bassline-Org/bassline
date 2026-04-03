import cytoscape from 'cytoscape'
import edgehandles from 'cytoscape-edgehandles'
import cxtmenu from 'cytoscape-cxtmenu'
import tidytree from 'cytoscape-tidytree'

cytoscape.use(edgehandles)
cytoscape.use(cxtmenu)
cytoscape.use(tidytree)

export const graphName = () => location.hash.slice(1) || null

const container = document.getElementById('container')
const layout = { name: 'tidytree', direction: 'LR' }

const sty = (selector, style) => ({ selector, style })

const style = [
  sty('node', {
    label: ele => {
      const label = ele.data('label') || ''
      const type = ele.data('type') || ''
      return type ? `${label}\n(${type})` : label
    },
    'text-wrap': 'wrap',
    'font-size': '12px',
  }),
]

export const cy = cytoscape({ container, layout, style })

export const persist = {
  async save() {
    const name = graphName()
    if (!name) return
    const elements = cy.elements().jsons()
    await fetch(`/api/graphs/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements }),
    })
  },
  async load() {
    const name = graphName()
    if (!name) return
    const res = await fetch(`/api/graphs/${name}`)
    if (!res.ok) return
    const data = await res.json()
    cy.elements().remove()
    cy.add(data.elements)
    cy.fit(undefined, 50)
  },
}

persist.load()

window.addEventListener('hashchange', persist.load)
