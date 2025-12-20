/**
 * TCL commands for blit boot scripts.
 *
 * Provides native TCL commands instead of requiring JSON hand-writing:
 *   cell create <name> -lattice <type>
 *   cell get <name>
 *   cell set <name> <value>
 *   cell value <name>
 *
 *   store get <key>
 *   store set <key> <value>
 *   store keys
 *
 *   sql query <sql> ?param ...?
 *   sql execute <sql> ?param ...?
 *
 *   kit get <path>
 *   kit put <path> <value>
 */

import { parseList } from '@bassline/tcl'

/**
 * Parse TCL-style options from args.
 * Returns { options: {}, rest: [] }
 * @param args
 */
function parseOptions(args) {
  const options = {}
  const rest = []
  let i = 0

  while (i < args.length) {
    const arg = args[i]
    if (arg.startsWith('-')) {
      const key = arg.slice(1)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[key] = args[i + 1]
        i += 2
      } else {
        options[key] = true
        i += 1
      }
    } else {
      rest.push(arg)
      i += 1
    }
  }

  return { options, rest }
}

/**
 * Create blit-specific TCL commands.
 * @param {object} conn - SQLite connection
 * @param {object} kit - The blit's kit (all access goes through this)
 */
export function createBlitCommands(conn, kit) {
  return {
    /**
     * cell create <name> -lattice <type>
     * cell get <name>
     * cell set <name> <value>
     * cell value <name>
     * cell exists <name>
     * @param args
     */
    cell: async args => {
      const [subcmd, ...rest] = args

      switch (subcmd) {
        case 'create': {
          const { options, rest: positional } = parseOptions(rest)
          const name = positional[0]
          if (!name) throw new Error('cell create: missing name')
          if (!options.lattice) throw new Error('cell create: missing -lattice option')

          // Check if cell already exists (idempotent create)
          const existing = await kit.get({ path: `/cells/${name}` })
          if (existing.headers?.condition !== 'not-found') {
            // Cell exists - return current value without resetting
            return existing.body?.value ?? ''
          }

          const result = await kit.put({ path: `/cells/${name}` }, { lattice: options.lattice })
          return result.body?.value ?? ''
        }

        case 'get': {
          const name = rest[0]
          if (!name) throw new Error('cell get: missing name')
          const result = await kit.get({ path: `/cells/${name}` })
          if (result.headers?.condition === 'not-found') {
            throw new Error(`cell "${name}" not found`)
          }
          return JSON.stringify(result.body)
        }

        case 'set': {
          const name = rest[0]
          const value = rest[1]
          if (!name) throw new Error('cell set: missing name')
          if (value === undefined) throw new Error('cell set: missing value')

          // Try to parse as number or use as-is
          let parsed = value
          if (!isNaN(Number(value))) {
            parsed = Number(value)
          } else {
            try {
              parsed = JSON.parse(value)
            } catch {
              // Keep as string
            }
          }

          const result = await kit.put({ path: `/cells/${name}/value` }, parsed)
          return String(result.body ?? '')
        }

        case 'value': {
          const name = rest[0]
          if (!name) throw new Error('cell value: missing name')
          const result = await kit.get({ path: `/cells/${name}/value` })
          if (result.headers?.condition === 'not-found') {
            throw new Error(`cell "${name}" not found`)
          }
          return String(result.body ?? '')
        }

        case 'exists': {
          const name = rest[0]
          if (!name) throw new Error('cell exists: missing name')
          const result = await kit.get({ path: `/cells/${name}` })
          return result.headers?.condition === 'not-found' ? '0' : '1'
        }

        default:
          throw new Error(`cell: unknown subcommand "${subcmd}"`)
      }
    },

    /**
     * store get <key>
     * store set <key> <value>
     * store keys
     * @param args
     */
    store: async args => {
      const [subcmd, ...rest] = args

      switch (subcmd) {
        case 'get': {
          const key = rest[0]
          if (!key) throw new Error('store get: missing key')
          const result = await kit.get({ path: `/store/${key}` })
          if (result.headers?.condition === 'not-found') {
            return ''
          }
          return typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
        }

        case 'set': {
          const key = rest[0]
          const value = rest.slice(1).join(' ')
          if (!key) throw new Error('store set: missing key')

          // Try to parse as dict/list, otherwise store as string
          let parsed = value
          try {
            // Check if it looks like a TCL dict
            const items = parseList(value)
            if (items.length > 0 && items.length % 2 === 0) {
              // Convert to object
              const obj = {}
              for (let i = 0; i < items.length; i += 2) {
                obj[items[i]] = items[i + 1]
              }
              parsed = obj
            }
          } catch {
            // Keep as string
          }

          await kit.put({ path: `/store/${key}` }, parsed)
          return value
        }

        case 'keys': {
          const result = await kit.get({ path: '/store' })
          return (result.body || []).join(' ')
        }

        case 'delete': {
          const key = rest[0]
          if (!key) throw new Error('store delete: missing key')
          await kit.put({ path: `/store/${key}` }, null)
          return ''
        }

        default:
          throw new Error(`store: unknown subcommand "${subcmd}"`)
      }
    },

    /**
     * sql query <sql> ?param ...?
     * sql execute <sql> ?param ...?
     * @param args
     */
    sql: args => {
      const [subcmd, sql, ...params] = args

      switch (subcmd) {
        case 'query': {
          if (!sql) throw new Error('sql query: missing SQL')
          const result = conn.query(sql, params)
          // Return as TCL list of dicts
          return result.rows
            .map(row => {
              const pairs = Object.entries(row)
                .map(([k, v]) => `${k} {${v}}`)
                .join(' ')
              return `{${pairs}}`
            })
            .join(' ')
        }

        case 'execute': {
          if (!sql) throw new Error('sql execute: missing SQL')
          const result = conn.execute(sql, params)
          return `changes ${result.changes} lastInsertRowid ${result.lastInsertRowid}`
        }

        default:
          throw new Error(`sql: unknown subcommand "${subcmd}"`)
      }
    },

    /**
     * kit get <path>
     * kit put <path> <value>
     * @param args
     */
    kit: async args => {
      const [subcmd, path, ...rest] = args

      switch (subcmd) {
        case 'get': {
          if (!path) throw new Error('kit get: missing path')
          const result = await kit.get({ path })
          return typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
        }

        case 'put': {
          if (!path) throw new Error('kit put: missing path')
          const value = rest.join(' ')

          let parsed = value
          try {
            parsed = JSON.parse(value)
          } catch {
            // Keep as string
          }

          await kit.put({ path }, parsed)
          return value
        }

        default:
          throw new Error(`kit: unknown subcommand "${subcmd}"`)
      }
    },
  }
}
