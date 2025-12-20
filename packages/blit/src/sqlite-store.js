import { resource, routes, bind } from '@bassline/core/resource'

/**
 * Create a SQLite-backed key/value store resource.
 *
 * Routes:
 * GET  /           → list all keys in table
 * GET  /:key       → get value by key
 * PUT  /:key       → upsert value by key
 * @param {object} conn - SQLite connection from @bassline/database
 * @param {string} table - Table name (must be a valid identifier)
 */
export const createSQLiteStore = (conn, table) => {
  // Validate table name to prevent injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`)
  }

  return routes({
    '': resource({
      get: async () => {
        const result = conn.query(`SELECT key FROM ${table}`)
        return {
          headers: { type: 'directory' },
          body: result.rows.map(r => r.key),
        }
      },
    }),

    unknown: bind(
      'key',
      resource({
        get: async h => {
          const result = conn.query(`SELECT value FROM ${table} WHERE key = ?`, [h.params.key])

          if (result.rows.length === 0) {
            return { headers: { condition: 'not-found' }, body: null }
          }

          // Try to parse as JSON, otherwise return raw
          const raw = result.rows[0].value
          try {
            return { headers: { type: 'json' }, body: JSON.parse(raw) }
          } catch {
            return { headers: { type: 'text' }, body: raw }
          }
        },

        put: async (h, body) => {
          // DELETE: putting null removes the key
          if (body === null) {
            conn.execute(`DELETE FROM ${table} WHERE key = ?`, [h.params.key])
            return { headers: { deleted: true }, body: null }
          }

          const value = typeof body === 'string' ? body : JSON.stringify(body)

          conn.execute(
            `INSERT INTO ${table} (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [h.params.key, value]
          )

          return { headers: {}, body }
        },
      })
    ),
  })
}
