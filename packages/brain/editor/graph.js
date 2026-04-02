import cytoscape from 'cytoscape'
import edgehandles from 'cytoscape-edgehandles'
import cxtmenu from 'cytoscape-cxtmenu'

cytoscape.use(edgehandles)
cytoscape.use(cxtmenu)

function typeColor(type) {
  if (!type) return '#4a6670'
  let hash = 0
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash)
  const h = ((hash % 360) + 360) % 360
  return `hsl(${h}, 35%, 35%)`
}

export const graphName = () => location.hash.slice(1) || null

export const cy = cytoscape({
  container: document.getElementById('container'),
  layout: { name: 'preset' },
  style: [
    {
      selector: 'node',
      style: {
        'background-color': (ele) => typeColor(ele.data('type')),
        'label': (ele) => {
          const label = ele.data('label') || ''
          const type = ele.data('type') || ''
          return type ? `${label}\n(${type})` : label
        },
        'text-wrap': 'wrap',
        'color': '#e0e0e0',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'width': 50,
        'height': 50,
        'border-width': 2,
        'border-color': '#6a8a96',
      },
    },
    {
      selector: 'node[?live]',
      style: {
        'border-style': 'solid',
        'opacity': 1,
      },
    },
    {
      selector: 'node[!live]',
      style: {
        'border-style': 'dashed',
        'opacity': 0.6,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#5a8a9a',
        'border-color': '#8abaca',
        'border-width': 3,
      },
    },
    {
      selector: 'node:grabbed',
      style: { 'opacity': 0.8 },
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#6a8a96',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#6a8a96',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge:selected',
      style: {
        'line-color': '#8abaca',
        'target-arrow-color': '#8abaca',
        'width': 3,
      },
    },
    {
      selector: '.eh-source',
      style: { 'border-color': '#8abaca', 'border-width': 3 },
    },
    {
      selector: '.eh-target',
      style: { 'border-color': '#a0d0a0', 'border-width': 3 },
    },
    {
      selector: '.eh-preview, .eh-ghost-edge',
      style: {
        'line-color': '#8abaca',
        'target-arrow-color': '#8abaca',
        'line-style': 'dashed',
      },
    },
  ],
})

export const eh = cy.edgehandles({
  canConnect: (src, tgt) => !src.same(tgt) && !src.edgesTo(tgt).length,
  edgeParams: (src, tgt) => ({
    data: { id: `${src.id()}->${tgt.id()}` },
  }),
})

export async function save() {
  const name = graphName()
  if (!name) return
  const elements = cy.elements().jsons()
  await fetch(`/api/graphs/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elements }),
  })
}

export async function load() {
  const name = graphName()
  if (!name) return
  const res = await fetch(`/api/graphs/${name}`)
  if (!res.ok) return
  const data = await res.json()
  cy.elements().remove()
  cy.add(data.elements)
  cy.fit(undefined, 50)
}

load()
window.addEventListener('hashchange', load)
