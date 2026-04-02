#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [command, ...args] = process.argv.slice(2)

if (command === 'edit') {
  const port = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 5173
  const graphsDir = resolve('graphs')
  const editorRoot = new URL('../editor', import.meta.url).pathname

  const { createServer } = await import('vite')
  const { graphApi } = await import('../editor/plugin.js')

  const server = await createServer({
    root: editorRoot,
    server: { port },
    plugins: [graphApi(graphsDir)],
  })

  await server.listen()
  server.printUrls()
} else if (command === 'run') {
  const [graphPath, typesPath, scriptPath] = args
  if (!graphPath || !typesPath) {
    console.error('Usage: brain run <graph.json> <types.js> [script.js]')
    process.exit(1)
  }

  const { build } = await import('../src/build.js')
  const graph = JSON.parse(readFileSync(resolve(graphPath), 'utf8'))
  const { types } = await import(resolve(typesPath))
  const nodes = build(graph.elements, types)
  console.log('Built:', Object.keys(nodes).join(', '))

  if (scriptPath) {
    const script = await import(resolve(scriptPath))
    await script.default(nodes)
  }
} else {
  console.error('Usage: brain <edit|run> [args...]')
  console.error('  brain edit [--port N]')
  console.error('  brain run <graph.json> <types.js> [script.js]')
  process.exit(1)
}
