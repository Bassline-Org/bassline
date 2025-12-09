import { routes } from '@bassline/core'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * Create file-based storage routes
 *
 * @param {string} dataDir - Directory to store files
 * @param {string} [prefix='/data'] - URL prefix for these routes
 * @returns {import('@bassline/core').RouterBuilder}
 *
 * @example
 * const bl = new Bassline()
 * bl.install(createFileStore('.bassline', '/data'))
 *
 * // Store JSON documents
 * bl.put('bl:///data/cells/counter', {}, { type: 'cell', value: 42 })
 * bl.get('bl:///data/cells/counter')
 * // → { headers: { type: 'document' }, body: { type: 'cell', value: 42 } }
 */
export function createFileStore(dataDir, prefix = '/data') {
  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return routes(prefix, r => {
    // List contents at root
    r.get('/', () => listDir(dataDir, prefix))

    // Get/put documents by path (wildcard matches nested paths)
    r.route('/:path*', {
      get: ({ params }) => {
        const subPath = params.path
        const filePath = join(dataDir, subPath + '.json')
        const dirPath = join(dataDir, subPath)

        // Check if it's a directory
        if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
          return listDir(dirPath, `${prefix}/${subPath}`)
        }

        // Try to read as file
        if (!existsSync(filePath)) {
          return null
        }

        try {
          const content = readFileSync(filePath, 'utf-8')
          const doc = JSON.parse(content)
          return {
            headers: { type: doc.type || 'document' },
            body: doc
          }
        } catch (err) {
          return {
            headers: { error: 'read-error' },
            body: { message: err.message }
          }
        }
      },

      put: ({ params, body }) => {
        const subPath = params.path
        const filePath = join(dataDir, subPath + '.json')

        try {
          // Ensure parent directory exists
          const dir = dirname(filePath)
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
          }

          writeFileSync(filePath, JSON.stringify(body, null, 2))
          return {
            headers: { type: body.type || 'document' },
            body
          }
        } catch (err) {
          return {
            headers: { error: 'write-error' },
            body: { message: err.message }
          }
        }
      }
    })
  })
}

/**
 * List directory contents
 * @private
 */
function listDir(dirPath, urlPrefix) {
  if (!existsSync(dirPath)) {
    return { headers: { type: 'directory' }, body: { entries: [] } }
  }

  try {
    const entries = readdirSync(dirPath).map(name => {
      const fullPath = join(dirPath, name)
      const isDir = statSync(fullPath).isDirectory()
      const baseName = name.replace(/\.json$/, '')
      return {
        name: baseName,
        type: isDir ? 'directory' : 'document',
        uri: `bl://${urlPrefix}/${baseName}`
      }
    })

    return {
      headers: { type: 'directory' },
      body: { entries }
    }
  } catch (err) {
    return {
      headers: { error: 'list-error' },
      body: { message: err.message }
    }
  }
}
