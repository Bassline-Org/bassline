/**
 * Load blits using the blit resource manager.
 * Uses createBlits() from @bassline/blit - no direct kit access.
 */

import { existsSync } from 'fs'
import { createBlits } from '@bassline/blit'
import { createSQLiteConnection } from '@bassline/database'
import { initSchema } from '@bassline/blit/schema'

// Resource interface matches @bassline/core
interface Resource {
  get: (headers: {
    path: string
    [key: string]: unknown
  }) => Promise<{ headers: Record<string, unknown>; body: unknown }>
  put: (
    headers: { path: string; [key: string]: unknown },
    body: unknown
  ) => Promise<{ headers: Record<string, unknown>; body: unknown }>
}

interface LoadedBlit {
  kit: Resource // Resource wrapper for blit access
  checkpoint: () => Promise<void>
  close: () => Promise<void>
  bootOutput: unknown
}

/**
 * Load an existing blit from a SQLite file.
 * Uses createBlits() to manage the blit as a resource.
 *
 * @param filePath - Path to the .blit file
 * @param options.force - Force re-run boot script even if initialized
 */
export async function loadBlit(filePath: string, options: { force?: boolean } = {}): Promise<LoadedBlit> {
  if (!existsSync(filePath)) {
    throw new Error(`Blit file not found: ${filePath}`)
  }

  // Create blit manager
  const blits = createBlits()

  // Load the blit under name 'app'
  const result = await blits.put({ path: '/app' }, { path: filePath, force: options.force })

  // Create a resource wrapper that prefixes all paths with /app
  // This allows components to use paths like /store/... and /tcl/eval
  // which become /app/store/... and /app/tcl/eval
  const kit: Resource = {
    get: h => blits.get({ ...h, path: '/app' + h.path }),
    put: (h, body) => blits.put({ ...h, path: '/app' + h.path }, body),
  }

  return {
    kit,
    checkpoint: async () => {
      await blits.put({ path: '/app/checkpoint' }, {})
    },
    close: async () => {
      await blits.put({ path: '/app/close' }, {})
    },
    bootOutput: (result.body as Record<string, unknown>)?.bootOutput,
  }
}

/**
 * Create a new blit file with optional boot script.
 * @param filePath - Path for the new .blit file
 * @param options.bootScript - Optional init.tcl content
 */
export async function createBlit(filePath: string, options: { bootScript?: string } = {}): Promise<LoadedBlit> {
  if (existsSync(filePath)) {
    throw new Error(`Blit file already exists: ${filePath}`)
  }

  // Create new SQLite database and initialize schema
  const conn = createSQLiteConnection({ path: filePath })
  initSchema(conn)

  // Add boot script if provided
  if (options.bootScript) {
    conn.execute('INSERT INTO _boot (key, value) VALUES (?, ?)', ['init.tcl', options.bootScript])
  }

  conn.close()

  // Load the newly created blit
  return loadBlit(filePath, { force: true })
}

/**
 * Check if a file is a valid blit (has required tables).
 */
export function isValidBlit(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false
  }

  try {
    const conn = createSQLiteConnection({ path: filePath })
    const result = conn.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_boot'")
    conn.close()
    return result.rows.length > 0
  } catch {
    return false
  }
}
