import { resource } from '@bassline/core'
import { createSQLiteConnection } from './sqlite.js'

/**
 * Create database service routes.
 *
 * Provides:
 * - Connection management (SQLite for now)
 * - Query execution
 * - Schema introspection
 * - Transaction support
 */
export function createDatabaseRoutes(options = {}) {
  const { bl } = options

  // Store connections: name -> { config, connection }
  const connections = new Map()

  /**
   * Get or create a connection
   */
  function getConnection(name) {
    if (!connections.has(name)) {
      throw new Error(`Connection not found: ${name}`)
    }

    const entry = connections.get(name)

    // Lazy initialize
    if (!entry.connection) {
      entry.connection = createSQLiteConnection(entry.config)
    }

    return entry.connection
  }

  const databaseResource = resource(r => {
    // Service info
    r.get('/', () => ({
      headers: { type: 'bl:///types/service' },
      body: {
        name: 'Database',
        description: 'SQLite database service',
        version: '1.0.0',
        driver: 'sqlite',
        entries: [
          { name: 'connections', uri: 'bl:///database/connections' }
        ]
      }
    }))

    // List connections
    r.get('/connections', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [...connections.keys()].map(name => {
          const entry = connections.get(name)
          return {
            name,
            type: 'database-connection',
            uri: `bl:///database/connections/${name}`,
            path: entry.config.path,
            connected: !!entry.connection
          }
        })
      }
    }))

    // Get connection info
    r.get('/connections/:name', ({ params }) => {
      const entry = connections.get(params.name)
      if (!entry) return null

      return {
        headers: { type: 'bl:///types/database-connection' },
        body: {
          name: params.name,
          driver: 'sqlite',
          path: entry.config.path,
          readonly: entry.config.readonly || false,
          connected: !!entry.connection,
          entries: [
            { name: 'query', uri: `bl:///database/connections/${params.name}/query` },
            { name: 'execute', uri: `bl:///database/connections/${params.name}/execute` },
            { name: 'schema', uri: `bl:///database/connections/${params.name}/schema` },
            { name: 'pragma', uri: `bl:///database/connections/${params.name}/pragma` }
          ]
        }
      }
    })

    // Create/update connection
    r.put('/connections/:name', ({ params, body }) => {
      const config = {
        path: body.path || ':memory:',
        readonly: body.readonly || false,
        fileMustExist: body.fileMustExist || false
      }

      connections.set(params.name, {
        config,
        connection: null // Lazy initialized
      })

      return {
        headers: { type: 'bl:///types/database-connection' },
        body: {
          name: params.name,
          driver: 'sqlite',
          ...config,
          entries: [
            { name: 'query', uri: `bl:///database/connections/${params.name}/query` },
            { name: 'execute', uri: `bl:///database/connections/${params.name}/execute` },
            { name: 'schema', uri: `bl:///database/connections/${params.name}/schema` }
          ]
        }
      }
    })

    // Execute query (SELECT)
    r.put('/connections/:name/query', ({ params, body }) => {
      const conn = getConnection(params.name)
      const { sql, params: queryParams = [] } = body

      if (!sql) {
        throw new Error('Missing sql parameter')
      }

      const result = conn.query(sql, queryParams)

      return {
        headers: {
          type: 'bl:///types/database-result',
          rowCount: result.rowCount
        },
        body: {
          rows: result.rows,
          columns: result.columns,
          rowCount: result.rowCount
        }
      }
    })

    // Execute statement (INSERT, UPDATE, DELETE)
    r.put('/connections/:name/execute', ({ params, body }) => {
      const conn = getConnection(params.name)
      const { sql, params: stmtParams = [] } = body

      if (!sql) {
        throw new Error('Missing sql parameter')
      }

      const result = conn.execute(sql, stmtParams)

      // Dispatch change event through plumber
      if (bl._plumber) {
        bl._plumber.dispatch({
          uri: `bl:///database/connections/${params.name}`,
          headers: {
            type: 'bl:///types/database-change',
            changes: result.changes
          },
          body: {
            connection: params.name,
            sql,
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
          }
        })
      }

      return {
        headers: {
          type: 'bl:///types/database-execute-result',
          changes: result.changes
        },
        body: {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        }
      }
    })

    // Get schema
    r.get('/connections/:name/schema', ({ params }) => {
      const conn = getConnection(params.name)
      const schema = conn.introspect()

      return {
        headers: { type: 'bl:///types/database-schema' },
        body: {
          connection: params.name,
          tables: schema.tables.map(t => ({
            ...t,
            uri: `bl:///database/connections/${params.name}/schema/${t.name}`
          }))
        }
      }
    })

    // Get table schema
    r.get('/connections/:name/schema/:table', ({ params }) => {
      const conn = getConnection(params.name)
      const schema = conn.introspect()
      const table = schema.tables.find(t => t.name === params.table)

      if (!table) return null

      return {
        headers: { type: 'bl:///types/database-table' },
        body: table
      }
    })

    // Execute PRAGMA
    r.put('/connections/:name/pragma', ({ params, body }) => {
      const conn = getConnection(params.name)
      const { pragma } = body

      if (!pragma) {
        throw new Error('Missing pragma parameter')
      }

      const result = conn.pragma(pragma)

      return {
        headers: { type: 'bl:///types/database-pragma-result' },
        body: { result }
      }
    })

    // Close connection
    r.put('/connections/:name/close', ({ params }) => {
      const entry = connections.get(params.name)
      if (entry?.connection) {
        entry.connection.close()
        entry.connection = null
      }

      return {
        headers: { type: 'bl:///types/database-connection' },
        body: { name: params.name, connected: false }
      }
    })
  })

  /**
   * Install database routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/database'] - Mount prefix
   */
  function install(blInstance, { prefix = '/database' } = {}) {
    blInstance.mount(prefix, databaseResource)
  }

  return {
    routes: databaseResource,
    install,
    getConnection,
    _connections: connections
  }
}
