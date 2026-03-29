import { createDiagram, createOntology, createSpine, createLine, setSpineOntology, setLineOntology } from './queries'

async function seed() {
  console.log('Seeding database...')

  // Create ontologies
  const graph = await createOntology('graph', '#3b82f6')
  const storage = await createOntology('storage', '#22c55e')
  const unknown = await createOntology('unknown', '#9ca3af')

  console.log('Created ontologies:', graph.name, storage.name, unknown.name)

  // Create a diagram
  const diagram = await createDiagram('Sample System')
  console.log('Created diagram:', diagram.name)

  // Create spines
  const a = await createSpine(diagram.id, 200, 150, 'client')
  const b = await createSpine(diagram.id, 500, 150, 'graph-store')
  const c = await createSpine(diagram.id, 500, 350, 'sqlite')
  const d = await createSpine(diagram.id, 200, 350, 'watcher')

  console.log('Created 4 spines')

  // Set ontologies on spines
  await setSpineOntology(a.id, unknown.id)
  await setSpineOntology(b.id, graph.id)
  await setSpineOntology(c.id, storage.id)
  await setSpineOntology(d.id, graph.id)

  // Create lines between spines
  const l1 = await createLine(diagram.id, a.id, 'default', b.id, 'default')
  const l2 = await createLine(diagram.id, b.id, 'default', c.id, 'default')
  const l3 = await createLine(diagram.id, b.id, 'default', d.id, 'default')

  // Set ontologies on lines
  await setLineOntology(l1.id, graph.id)
  await setLineOntology(l2.id, storage.id)
  await setLineOntology(l3.id, graph.id)

  console.log('Created 3 lines')
  console.log('Seed complete!')

  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
