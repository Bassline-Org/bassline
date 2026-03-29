import {
  createDiagram,
  createOntology,
  createSpine,
  createHandle,
  getHandleByName,
  createLine,
  setEntityOntology,
  createCapability,
  attachCapability,
} from './queries'

async function seed() {
  console.log('Seeding database...')

  // Ontologies (these are also layers)
  const graph = await createOntology('graph', '#3b82f6')
  const storage = await createOntology('storage', '#22c55e')
  const unknown = await createOntology('unknown', '#9ca3af')
  console.log('Created ontologies:', graph.name, storage.name, unknown.name)

  // Diagram
  const diagram = await createDiagram('Sample System')
  console.log('Created diagram:', diagram.name)

  // Spines with layer assignments
  const a = await createSpine(diagram.id, 200, 100, 'client', unknown.id)
  const b = await createSpine(diagram.id, 500, 100, 'graph-store', graph.id)
  const c = await createSpine(diagram.id, 500, 300, 'sqlite', storage.id)
  const d = await createSpine(diagram.id, 200, 300, 'watcher', graph.id)
  console.log('Created 4 spines')

  // Extra handle on graph-store
  const bStorage = await createHandle(b.id, 'storage')
  console.log('Added storage handle to graph-store')

  // Ontology annotations on spines
  await setEntityOntology(a.id, 'spine', unknown.id)
  await setEntityOntology(b.id, 'spine', graph.id)
  await setEntityOntology(c.id, 'spine', storage.id)
  await setEntityOntology(d.id, 'spine', graph.id)

  // Get default handles
  const aDefault = await getHandleByName(a.id, 'default')
  const bDefault = await getHandleByName(b.id, 'default')
  const cDefault = await getHandleByName(c.id, 'default')
  const dDefault = await getHandleByName(d.id, 'default')

  // Lines
  const l1 = await createLine(diagram.id, aDefault!.id, bDefault!.id)
  const l2 = await createLine(diagram.id, bStorage.id, cDefault!.id)
  const l3 = await createLine(diagram.id, bDefault!.id, dDefault!.id)
  console.log('Created 3 lines')

  // Ontology annotations on lines
  await setEntityOntology(l1.id, 'line', graph.id)
  await setEntityOntology(l2.id, 'line', storage.id)
  await setEntityOntology(l3.id, 'line', graph.id)

  // Example capability
  const validateCap = await createCapability(
    'validate-connection',
    '/api/caps/validate-connection',
    'Checks if connected handles share compatible ontologies',
    'connect'
  )
  console.log('Created capability:', validateCap.name)

  // Attach capability to graph-store's default handle
  await attachCapability(bDefault!.id, 'handle', validateCap.id)
  console.log('Attached capability to graph-store:default')

  console.log('Seed complete!')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
