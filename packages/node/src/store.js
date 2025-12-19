import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { resource, routes, bind, splitPath } from '@bassline/core'

/**
 * Create a file-based store resource.
 *
 * API (same for all store backends):
 *   GET { path: '/foo/bar.json' }  → { headers: {}, body: <contents> }
 *   PUT { path: '/foo/bar.json' }, data → { headers: {}, body: data }
 *   GET { path: '/foo' } (directory) → { headers: {}, body: [entries...] }
 *
 * @param {string} root - Base directory for storage
 */
export const createFileStore = (root) => {
  const resolve = (path) => join(root, path ?? '')

  return resource({
    get: async (h) => {
      const fullPath = resolve(h.path)
      try {
        const info = await stat(fullPath)
        if (info.isDirectory()) {
          const entries = await readdir(fullPath)
          return { headers: { type: 'directory' }, body: entries }
        }
        const data = await readFile(fullPath, 'utf-8')
        // Try to parse as JSON, otherwise return raw
        try {
          return { headers: { type: 'json' }, body: JSON.parse(data) }
        } catch {
          return { headers: { type: 'text' }, body: data }
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          return { headers: { status: 404 }, body: null }
        }
        return { headers: { status: 500, error: err.message }, body: null }
      }
    },

    put: async (h, body) => {
      const fullPath = resolve(h.path)
      try {
        await mkdir(dirname(fullPath), { recursive: true })
        const data = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
        await writeFile(fullPath, data, 'utf-8')
        return { headers: {}, body }
      } catch (err) {
        return { headers: { status: 500, error: err.message }, body: null }
      }
    }
  })
}

export default createFileStore
