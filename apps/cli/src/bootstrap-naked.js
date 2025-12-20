/* eslint-env node */
/**
 * Naked Bassline bootstrap - minimal install for Tcl scripting.
 *
 * Only installs:
 * - Plumber (message routing)
 * - Tcl (scripting)
 * - HTTP server (transport)
 *
 * Everything else can be bootstrapped via Tcl scripts.
 *
 * Usage:
 *   BL_BOOTSTRAP=./apps/cli/src/bootstrap-naked.js node apps/cli/src/daemon.js
 */

const HTTP_PORT = parseInt(process.env.BL_HTTP_PORT || process.env.BL_PORT || '9111')

/**
 * Bootstrap a naked Bassline instance
 * @param {import('@bassline/core').Bassline} bl - The Bassline instance
 */
export default async function bootstrapNaked(bl) {
  // Plumber: message routing
  await bl.put(
    'bl:///install/plumber',
    {},
    {
      path: './packages/plumber/src/upgrade.js',
    }
  )

  // Tcl: scripting language
  await bl.put(
    'bl:///install/tcl',
    {},
    {
      path: './packages/tcl/src/upgrade.js',
    }
  )

  // HTTP: transport
  await bl.put(
    'bl:///install/http-server',
    {},
    {
      path: './packages/server-node/src/upgrade-http-server.js',
      ports: [HTTP_PORT],
    }
  )

  console.log('Bassline daemon running (naked)')
  console.log(`  HTTP:  http://localhost:${HTTP_PORT}`)
  console.log('')
  console.log('Evaluate Tcl:')
  console.log(`  curl -X PUT "http://localhost:${HTTP_PORT}?uri=bl:///eval" \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"script": "puts hello"}'`)
  console.log('')
  console.log('Install more modules:')
  console.log(`  curl -X PUT "http://localhost:${HTTP_PORT}?uri=bl:///install/cells" \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"path": "./packages/cells/src/upgrade.js"}'`)
}
