/**
 * Minimal Bassline Daemon
 *
 * This daemon only installs the module loader. Everything else is loaded
 * dynamically via bootstrap.js or manual PUT bl:///install/:name calls.
 *
 * Usage:
 *   node daemon.js                                    # Uses default bootstrap
 *   BL_BOOTSTRAP=./custom-bootstrap.js node daemon.js # Custom bootstrap
 *   BL_BOOTSTRAP=none node daemon.js                  # No bootstrap (minimal)
 */
import { Bassline, createInstallRoutes } from '@bassline/core'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Get the directory of this file for resolving bootstrap path
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a minimal Bassline instance
const bl = new Bassline()

// Only install the module loader - everything else is dynamic
const installer = createInstallRoutes({ baseDir: process.cwd() })
installer.install(bl)

// Determine bootstrap source
const BOOTSTRAP = process.env.BL_BOOTSTRAP || resolve(__dirname, 'bootstrap.js')

if (BOOTSTRAP === 'none') {
  // Minimal mode - no bootstrap
  console.log('Bassline daemon running (minimal)')
  console.log('  Install modules via: PUT bl:///install/:name { path: "..." }')
} else {
  // Bootstrap with modules
  try {
    const bootstrap = await import(BOOTSTRAP)
    await bootstrap.default(bl)
  } catch (e) {
    console.error('Bootstrap failed:', e.message)
    console.log('Starting in minimal mode')
    console.log('  Install modules via: PUT bl:///install/:name { path: "..." }')
  }
}
