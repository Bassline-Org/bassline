import { resource, routes } from '@bassline/core/resource'

/**
 * Create a SQL resource for executing queries against a SQLite connection.
 *
 * Routes:
 * PUT /query   → execute SELECT query, return rows
 * PUT /execute → execute INSERT/UPDATE/DELETE, return changes info
 *
 * Body formats:
 * - Simple: "SELECT * FROM users" (string, no params)
 * - With params: ["SELECT * FROM users WHERE name = ?", ["alice"]] (array)
 * - Named params: ["SELECT * FROM users WHERE name = :name", {name: "alice"}]
 * @param {object} conn - SQLite connection from @bassline/database
 */
export const createSQLResource = conn => {
  /**
   * Parse query body into { sql, params }
   * Accepts:
   * - string: just SQL, no params
   * - [sql, params]: SQL with positional or named params
   * @param body
   */
  const parseQueryBody = body => {
    if (typeof body === 'string') {
      return { sql: body, params: [] }
    }
    if (Array.isArray(body)) {
      const [sql, params = []] = body
      // Convert object params to array for named params
      if (params && typeof params === 'object' && !Array.isArray(params)) {
        return { sql, params }
      }
      return { sql, params: Array.isArray(params) ? params : [params] }
    }
    throw new Error('sql: body must be string or [sql, params]')
  }

  return routes({
    query: resource({
      put: async (h, body) => {
        const { sql, params } = parseQueryBody(body)
        const result = conn.query(sql, params)
        return {
          headers: { type: 'js/arr' },
          body: result.rows,
        }
      },
    }),

    execute: resource({
      put: async (h, body) => {
        const { sql, params } = parseQueryBody(body)
        const result = conn.execute(sql, params)
        return {
          headers: { type: 'js/obj' },
          body: {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          },
        }
      },
    }),
  })
}
