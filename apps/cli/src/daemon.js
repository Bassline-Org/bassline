#!/usr/bin/env node
/**
 * Bassline daemon - serves a blit over HTTP using the resource model.
 *
 * Usage:
 *   node daemon.js [blit-path] [port]
 *
 * Environment:
 *   BL_BLIT - Path to blit file (default: ~/.bassline/default.blit)
 *   BL_PORT - Port to listen on (default: 9111)
 */

import { homedir } from 'node:os'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { routes } from '@bassline/core'
import { createSQLiteConnection } from '@bassline/database'
import { createBlitKit, initSchema } from '@bassline/blit'
import { createHttpServer } from '@bassline/node'

const blitPath = process.argv[2] || process.env.BL_BLIT || join(homedir(), '.bassline', 'default.blit')
const port = parseInt(process.argv[3] || process.env.BL_PORT || '9111')

// Ensure directory exists
const dir = blitPath.substring(0, blitPath.lastIndexOf('/'))
if (dir && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

// Open database and create blit kit
const conn = createSQLiteConnection(blitPath)
initSchema(conn)
const { kit: blitKit, hydrate } = createBlitKit(conn)

// Hydrate state from SQLite
await hydrate()

// Create HTTP server resource
const httpServer = createHttpServer()

// Create root kit that includes both blit and http
const kit = routes({
  http: httpServer,
  unknown: blitKit, // Everything else goes to blit
})

// Make kit available to itself (for h.kit in handlers)
const selfKit = {
  get: h => kit.get({ ...h, kit: selfKit }),
  put: (h, b) => kit.put({ ...h, kit: selfKit }, b),
}

// Start the HTTP server by PUT to /http/:port
const result = await selfKit.put({ path: `/http/${port}` })
console.log(`Bassline daemon running at http://localhost:${port}`)
console.log(`Blit: ${blitPath}`)
console.log(`Status:`, result.body)

// Keep process alive
process.stdin.resume()
