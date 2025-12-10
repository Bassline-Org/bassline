/**
 * Standard Bassline bootstrap module.
 * Installs all core modules via the dynamic install system.
 *
 * This can be used as:
 * - BL_BOOTSTRAP=./apps/cli/src/bootstrap.js node apps/cli/src/daemon.js
 * - Or imported and called directly: bootstrap.default(bl)
 */

const DATA_DIR = process.env.BL_DATA || '.bassline'
const HTTP_PORT = parseInt(process.env.BL_HTTP_PORT || process.env.BL_PORT || '9111')
const WS_PORT = parseInt(process.env.BL_WS_PORT || '9112')

/**
 * Bootstrap a Bassline instance with all standard modules
 * @param {import('@bassline/core').Bassline} bl
 */
export default async function bootstrap(bl) {
  // Core: root index (lists all subsystems)
  await bl.put('bl:///install/index', {}, {
    path: './packages/core/src/upgrade-index.js'
  })

  // Core: types (built-in type definitions)
  await bl.put('bl:///install/types', {}, {
    path: './packages/core/src/upgrade-types.js'
  })

  // Core: links (bidirectional ref tracking)
  await bl.put('bl:///install/links', {}, {
    path: './packages/core/src/upgrade-links.js'
  })

  // Core: plumber (message routing)
  await bl.put('bl:///install/plumber', {}, {
    path: './packages/core/src/upgrade-plumber.js'
  })

  // Storage: file store
  await bl.put('bl:///install/file-store', {}, {
    path: './packages/store-node/src/upgrade-file-store.js',
    dataDir: DATA_DIR,
    prefix: '/data'
  })

  // Server: HTTP
  await bl.put('bl:///install/http-server', {}, {
    path: './packages/server-node/src/upgrade-http-server.js',
    ports: [HTTP_PORT]
  })

  // Server: WebSocket (requires plumber)
  await bl.put('bl:///install/ws-server', {}, {
    path: './packages/server-node/src/upgrade-ws-server.js',
    ports: [WS_PORT]
  })

  // Reactive: propagators
  await bl.put('bl:///install/propagators', {}, {
    path: './packages/propagators/src/upgrade.js'
  })

  // Reactive: cells (uses propagators and plumber)
  await bl.put('bl:///install/cells', {}, {
    path: './packages/cells/src/upgrade.js'
  })

  // Services: Claude (optional - requires ANTHROPIC_API_KEY)
  if (process.env.ANTHROPIC_API_KEY) {
    await bl.put('bl:///install/claude', {}, {
      path: './packages/services/src/upgrade-claude.js'
    })
  }

  console.log('Bassline daemon running')
  console.log(`  Data:  ${DATA_DIR}`)
  console.log(`  HTTP:  http://localhost:${HTTP_PORT}`)
  console.log(`  WS:    ws://localhost:${WS_PORT}`)
  console.log(`\nResources:`)
  console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///data`)
  console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///install`)
  console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///plumb/rules`)
}
