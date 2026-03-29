import {
  createDiagram,
  createOntology,
  createSpine,
  createHandle,
  getHandleByName,
  createLine,
  setSpineOntology,
  setLineOntology,
} from './queries'

async function seed() {
  console.log('Seeding database...')

  // Ontologies
  const graph = await createOntology('graph', '#3b82f6')
  const storage = await createOntology('storage', '#22c55e')
  const unknown = await createOntology('unknown', '#9ca3af')
  console.log('Created ontologies:', graph.name, storage.name, unknown.name)

  // Diagram
  const diagram = await createDiagram('Sample System')
  console.log('Created diagram:', diagram.name)

  // Spines (each gets a 'default' handle automatically)
  const a = await createSpine(diagram.id, 200, 100, 'client')
  const b = await createSpine(diagram.id, 500, 100, 'graph-store')
  const c = await createSpine(diagram.id, 500, 300, 'sqlite')
  const d = await createSpine(diagram.id, 200, 300, 'watcher')
  console.log('Created 4 spines')

  // graph-store plays an extra game
  const bStorage = await createHandle(b.id, 'storage')
  console.log('Added storage handle to graph-store')

  // Spine ontologies
  await setSpineOntology(a.id, unknown.id)
  await setSpineOntology(b.id, graph.id)
  await setSpineOntology(c.id, storage.id)
  await setSpineOntology(d.id, graph.id)

  // Get default handles for connections
  const aDefault = await getHandleByName(a.id, 'default')
  const bDefault = await getHandleByName(b.id, 'default')
  const cDefault = await getHandleByName(c.id, 'default')
  const dDefault = await getHandleByName(d.id, 'default')

  // Lines between handles
  const l1 = await createLine(diagram.id, aDefault!.id, bDefault!.id)
  const l2 = await createLine(diagram.id, bStorage.id, cDefault!.id)
  const l3 = await createLine(diagram.id, bDefault!.id, dDefault!.id)
  console.log('Created 3 lines')

  // Line ontologies
  await setLineOntology(l1.id, graph.id)
  await setLineOntology(l2.id, storage.id)
  await setLineOntology(l3.id, graph.id)

  console.log('Seed complete!')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
