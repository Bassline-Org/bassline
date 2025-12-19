import { resource, routes, bind } from '@bassline/core'
import { createSQLiteConnection } from './sqlite.js'

/**
 * Create database service resource
 *
 * Routes:
 *   GET  /                        → service info
 *   GET  /connections             → list connections
 *   GET  /connections/:name       → connection info
 *   PUT  /connections/:name       → create/update connection
 *   PUT  /connections/:name/query → execute SELECT
 *   PUT  /connections/:name/execute → execute INSERT/UPDATE/DELETE
 *   GET  /connections/:name/schema → get schema
 *   GET  /connections/:name/schema/:table → get table schema
 *   PUT  /connections/:name/pragma → execute PRAGMA
 *   PUT  /connections/:name/close → close connection
 */
export function createDatabase() {
  const connections = new Map()

  function getConnection(name) {
    if (!connections.has(name)) {
      throw new Error(`Connection not found: ${name}`)
    }
    const entry = connections.get(name)
    if (!entry.connection) {
      entry.connection = createSQLiteConnection(entry.config)
    }
    return entry.connection
  }

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/service' },
        body: {
          name: 'database',
          description: 'SQLite database service',
          resources: { '/connections': {} }
        }
      })
    }),

    connections: routes({
      '': resource({
        get: async () => ({
          headers: { type: '/types/bassline' },
          body: {
            name: 'connections',
            resources: Object.fromEntries(
              [...connections.keys()].map(name => {
                const entry = connections.get(name)
                return [`/${name}`, { path: entry.config.path, connected: !!entry.connection }]
              })
            )
          }
        })
      }),

      unknown: bind('name', routes({
        '': resource({
          get: async (h) => {
            const entry = connections.get(h.params.name)
            if (!entry) return { headers: { condition: 'not-found' }, body: null }

            return {
              headers: { type: '/types/database-connection' },
              body: {
                name: h.params.name,
                driver: 'sqlite',
                path: entry.config.path,
                readonly: entry.config.readonly || false,
                connected: !!entry.connection
              }
            }
          },

          put: async (h, body) => {
            const config = {
              path: body.path || ':memory:',
              readonly: body.readonly || false,
              fileMustExist: body.fileMustExist || false
            }

            connections.set(h.params.name, { config, connection: null })

            return {
              headers: { type: '/types/database-connection' },
              body: { name: h.params.name, driver: 'sqlite', ...config }
            }
          }
        }),

        query: resource({
          put: async (h, body) => {
            const conn = getConnection(h.params.name)
            const { sql, params: queryParams = [] } = body

            if (!sql) throw new Error('Missing sql parameter')

            const result = conn.query(sql, queryParams)

            return {
              headers: { type: '/types/database-result', rowCount: result.rowCount },
              body: { rows: result.rows, columns: result.columns, rowCount: result.rowCount }
            }
          }
        }),

        execute: resource({
          put: async (h, body) => {
            const conn = getConnection(h.params.name)
            const { sql, params: stmtParams = [] } = body

            if (!sql) throw new Error('Missing sql parameter')

            const result = conn.execute(sql, stmtParams)

            // Notify via kit if available
            if (h.kit) {
              await h.kit.put(
                { path: '/plumber/send' },
                {
                  source: `/database/connections/${h.params.name}`,
                  port: 'database-changes',
                  body: {
                    connection: h.params.name,
                    sql,
                    changes: result.changes,
                    lastInsertRowid: result.lastInsertRowid
                  }
                }
              )
            }

            return {
              headers: { type: '/types/database-execute-result', changes: result.changes },
              body: { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
            }
          }
        }),

        schema: routes({
          '': resource({
            get: async (h) => {
              const conn = getConnection(h.params.name)
              const schema = conn.introspect()

              return {
                headers: { type: '/types/database-schema' },
                body: { connection: h.params.name, tables: schema.tables }
              }
            }
          }),

          unknown: bind('table', resource({
            get: async (h) => {
              const conn = getConnection(h.params.name)
              const schema = conn.introspect()
              const table = schema.tables.find(t => t.name === h.params.table)

              if (!table) return { headers: { condition: 'not-found' }, body: null }

              return {
                headers: { type: '/types/database-table' },
                body: table
              }
            }
          }))
        }),

        pragma: resource({
          put: async (h, body) => {
            const conn = getConnection(h.params.name)
            const { pragma } = body

            if (!pragma) throw new Error('Missing pragma parameter')

            const result = conn.pragma(pragma)

            return {
              headers: { type: '/types/database-pragma-result' },
              body: { result }
            }
          }
        }),

        close: resource({
          put: async (h) => {
            const entry = connections.get(h.params.name)
            if (entry?.connection) {
              entry.connection.close()
              entry.connection = null
            }

            return {
              headers: { type: '/types/database-connection' },
              body: { name: h.params.name, connected: false }
            }
          }
        })
      }))
    })
  })
}

export default createDatabase
