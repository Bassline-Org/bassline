#!/usr/bin/env node

/**
 * Seed script for Bassline
 * Creates interesting interconnected data to explore in the editor
 */

const BASE_URL = process.env.BL_URL || 'http://localhost:9111'

async function put(uri, body) {
  const url = `${BASE_URL}?uri=${encodeURIComponent(uri)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`PUT ${uri} failed: ${res.status}`)
  console.log(`  ✓ ${uri}`)
  return res.json()
}

async function seed() {
  console.log('\n🌱 Seeding Bassline...\n')

  // ═══════════════════════════════════════════════════════════════════
  // TYPES - Describe the structure and purpose of resources
  // ═══════════════════════════════════════════════════════════════════
  console.log('📦 Types')

  await put('bl:///data/types/cell', {
    type: 'bl:///data/types/type',
    name: 'Cell',
    description: 'A reactive value container',
    schema: {
      value: { type: 'any', required: true },
      label: { type: 'string' }
    }
  })

  await put('bl:///data/types/note', {
    type: 'bl:///data/types/type',
    name: 'Note',
    description: 'A text note with optional links to other resources',
    schema: {
      title: { type: 'string', required: true },
      content: { type: 'string' },
      tags: { type: 'array', items: 'string' },
      links: { type: 'array', items: 'uri' }
    }
  })

  await put('bl:///data/types/task', {
    type: 'bl:///data/types/type',
    name: 'Task',
    description: 'A task with status and optional assignee',
    schema: {
      title: { type: 'string', required: true },
      status: { type: 'enum', values: ['todo', 'in-progress', 'done'] },
      assignee: { type: 'uri' },
      parent: { type: 'uri' }
    }
  })

  await put('bl:///data/types/person', {
    type: 'bl:///data/types/type',
    name: 'Person',
    description: 'A person in the system',
    schema: {
      name: { type: 'string', required: true },
      email: { type: 'string' },
      role: { type: 'string' },
      avatar: { type: 'string' }
    }
  })

  await put('bl:///data/types/type', {
    type: 'bl:///data/types/type',
    name: 'Type',
    description: 'Meta-type: describes other types',
    schema: {
      name: { type: 'string', required: true },
      description: { type: 'string' },
      schema: { type: 'object' }
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // PEOPLE - Some users to reference
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n👥 People')

  await put('bl:///data/people/alice', {
    type: 'bl:///data/types/person',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: 'architect',
    avatar: '👩‍💻'
  })

  await put('bl:///data/people/bob', {
    type: 'bl:///data/types/person',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'developer',
    avatar: '👨‍🔧'
  })

  await put('bl:///data/people/carol', {
    type: 'bl:///data/types/person',
    name: 'Carol White',
    email: 'carol@example.com',
    role: 'designer',
    avatar: '👩‍🎨'
  })

  // ═══════════════════════════════════════════════════════════════════
  // CELLS - Reactive values
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n⚡ Cells')

  await put('bl:///data/cells/counter', {
    type: 'bl:///data/types/cell',
    label: 'Counter',
    value: 42
  })

  await put('bl:///data/cells/temperature', {
    type: 'bl:///data/types/cell',
    label: 'Temperature (°C)',
    value: 21.5
  })

  await put('bl:///data/cells/online-users', {
    type: 'bl:///data/types/cell',
    label: 'Online Users',
    value: 7
  })

  await put('bl:///data/cells/build-status', {
    type: 'bl:///data/types/cell',
    label: 'Build Status',
    value: 'passing'
  })

  // ═══════════════════════════════════════════════════════════════════
  // NOTES - Linked knowledge
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📝 Notes')

  await put('bl:///data/notes/welcome', {
    type: 'bl:///data/types/note',
    title: 'Welcome to Bassline',
    content: `
Bassline is a reflective programming environment where everything is a resource.

Key concepts:
- URIs address everything
- Resources have headers (metadata) and body (content)
- Types are resources you can dereference
- Links are bidirectional

Try navigating around! Click any URI to explore.
    `.trim(),
    tags: ['intro', 'docs'],
    links: [
      'bl:///data/notes/architecture',
      'bl:///data/notes/types'
    ]
  })

  await put('bl:///data/notes/architecture', {
    type: 'bl:///data/types/note',
    title: 'Architecture Overview',
    content: `
The system is built on a few core primitives:

1. **Bassline Router** - Pattern-matched URI routing
2. **File Store** - JSON persistence at /data
3. **Link Index** - Bidirectional reference tracking
4. **Plumber** - Message routing based on pattern rules

All these are composable routes that install into a Bassline instance.
    `.trim(),
    tags: ['architecture', 'docs'],
    links: [
      'bl:///data/notes/welcome',
      'bl:///data/types/cell'
    ]
  })

  await put('bl:///data/notes/types', {
    type: 'bl:///data/types/note',
    title: 'Type System',
    content: `
Types are resources too! Every resource can have a 'type' header pointing to its type definition.

This enables:
- Schema validation
- View resolution (find views that handle a type)
- Self-describing data

See the types directory for examples.
    `.trim(),
    tags: ['types', 'docs'],
    links: [
      'bl:///data/types/cell',
      'bl:///data/types/note',
      'bl:///data/types/type'
    ]
  })

  await put('bl:///data/notes/ideas/graph-viz', {
    type: 'bl:///data/types/note',
    title: 'Graph Visualization',
    content: `
Idea: Use React Flow or similar to visualize resource connections.

Nodes = resources
Edges = links between them

Could query the link index to build the graph dynamically.
Assigned to Carol for design exploration.
    `.trim(),
    tags: ['idea', 'visualization'],
    links: [
      'bl:///data/people/carol',
      'bl:///data/tasks/graph-view'
    ]
  })

  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Work tracking with links
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n✅ Tasks')

  await put('bl:///data/tasks/editor-v1', {
    type: 'bl:///data/types/task',
    title: 'Complete Editor V1',
    status: 'in-progress',
    assignee: 'bl:///data/people/alice'
  })

  await put('bl:///data/tasks/address-bar', {
    type: 'bl:///data/types/task',
    title: 'Implement address bar navigation',
    status: 'done',
    parent: 'bl:///data/tasks/editor-v1',
    assignee: 'bl:///data/people/alice'
  })

  await put('bl:///data/tasks/view-resolver', {
    type: 'bl:///data/types/task',
    title: 'Type-based view resolution',
    status: 'done',
    parent: 'bl:///data/tasks/editor-v1',
    assignee: 'bl:///data/people/bob'
  })

  await put('bl:///data/tasks/graph-view', {
    type: 'bl:///data/types/task',
    title: 'Design graph visualization view',
    status: 'todo',
    parent: 'bl:///data/tasks/editor-v1',
    assignee: 'bl:///data/people/carol'
  })

  await put('bl:///data/tasks/realtime-sync', {
    type: 'bl:///data/types/task',
    title: 'WebSocket live updates',
    status: 'todo',
    parent: 'bl:///data/tasks/editor-v1',
    assignee: 'bl:///data/people/bob'
  })

  // ═══════════════════════════════════════════════════════════════════
  // PLUMBER RULES - Message routing examples
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔧 Plumber Rules')

  // Note: These go to /plumb/rules via the daemon, not /data
  const plumbUrl = (name) => `${BASE_URL}?uri=bl:///plumb/rules/${name}`

  await fetch(plumbUrl('cell-watcher'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      match: { body: { type: 'bl:///data/types/cell' } },
      port: 'cell-updates'
    })
  }).then(() => console.log('  ✓ bl:///plumb/rules/cell-watcher'))

  await fetch(plumbUrl('task-watcher'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      match: { body: { type: 'bl:///data/types/task' } },
      port: 'task-updates'
    })
  }).then(() => console.log('  ✓ bl:///plumb/rules/task-watcher'))

  // ═══════════════════════════════════════════════════════════════════
  // REACTIVE CELLS & PROPAGATORS - Live constraint network
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🔄 Reactive Cells & Propagators')

  // Create cells for a sum constraint: a + b = sum
  await put('bl:///cells/a', { lattice: 'maxNumber', label: 'A' })
  await put('bl:///cells/b', { lattice: 'maxNumber', label: 'B' })
  await put('bl:///cells/sum', { lattice: 'maxNumber', label: 'Sum (A + B)' })

  // Create propagator BEFORE setting values so it watches changes
  await put('bl:///propagators/add-ab', {
    inputs: ['bl:///cells/a', 'bl:///cells/b'],
    output: 'bl:///cells/sum',
    handler: 'sum'
  })

  // Set initial values - this triggers the propagator
  await put('bl:///cells/a/value', 5)
  await put('bl:///cells/b/value', 3)

  // Create cells for a product constraint: x * y = product
  await put('bl:///cells/x', { lattice: 'maxNumber', label: 'X' })
  await put('bl:///cells/y', { lattice: 'maxNumber', label: 'Y' })
  await put('bl:///cells/product', { lattice: 'maxNumber', label: 'Product (X * Y)' })

  // Create propagator BEFORE setting values
  await put('bl:///propagators/multiply-xy', {
    inputs: ['bl:///cells/x', 'bl:///cells/y'],
    output: 'bl:///cells/product',
    handler: 'product'
  })

  // Set initial values - this triggers the propagator
  await put('bl:///cells/x/value', 4)
  await put('bl:///cells/y/value', 7)

  // Create a set accumulator cell
  await put('bl:///cells/tags', { lattice: 'setUnion', label: 'Tag Collection' })
  await put('bl:///cells/tags/value', ['bassline', 'reactive'])

  // ═══════════════════════════════════════════════════════════════════
  // MONITORS - Composed URL polling (Timer + Fetch + Cell)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📡 Monitors')

  // JSONPlaceholder monitor - reliable test API
  await put('bl:///monitors/jsonplaceholder', {
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    interval: 30000,   // every 30 seconds
    enabled: false,    // start manually for demo
    extract: 'title'   // just extract the title field
  })

  // Another example - posts API
  await put('bl:///monitors/random-post', {
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    interval: 60000,   // every minute
    enabled: false
  })

  // ═══════════════════════════════════════════════════════════════════
  // CONFIG / META
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n⚙️  Config')

  await put('bl:///data/config/editor', {
    type: 'config',
    theme: 'dark',
    defaultUri: 'bl:///data',
    recentUris: [
      'bl:///data/notes/welcome',
      'bl:///data/cells/counter',
      'bl:///data/tasks/editor-v1'
    ]
  })

  console.log('\n✨ Seeding complete!\n')
  console.log('Try these URIs in the editor:')
  console.log('  bl:///data')
  console.log('  bl:///data/notes/welcome')
  console.log('  bl:///data/tasks')
  console.log('  bl:///data/types')
  console.log()
  console.log('Reactive cells and propagators:')
  console.log('  bl:///cells              (list all cells)')
  console.log('  bl:///cells/sum          (computed: a + b)')
  console.log('  bl:///cells/product      (computed: x * y)')
  console.log('  bl:///propagators        (list all propagators)')
  console.log()
  console.log('Monitors (Timer + Fetch + Cell):')
  console.log('  bl:///monitors           (list all monitors)')
  console.log('  bl:///monitors/jsonplaceholder')
  console.log('  PUT bl:///monitors/jsonplaceholder/start  (start polling)')
  console.log('  PUT bl:///monitors/jsonplaceholder/fetch  (trigger immediate fetch)')
  console.log()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
