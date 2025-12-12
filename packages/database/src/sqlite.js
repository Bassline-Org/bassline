import Database from 'better-sqlite3'

/**
 * Create a SQLite database connection.
 *
 * @param {Object} config - Configuration
 * @param {string} config.path - Database file path (or ':memory:')
 * @param {boolean} config.readonly - Open in readonly mode
 * @param {boolean} config.fileMustExist - Throw if file doesn't exist
 * @returns {Object} Database connection with query methods
 */
export function createSQLiteConnection(config = {}) {
  const { path = ':memory:', readonly = false, fileMustExist = false } = config

  const db = new Database(path, { readonly, fileMustExist })

  // Enable WAL mode for better concurrency
  if (!readonly && path !== ':memory:') {
    db.pragma('journal_mode = WAL')
  }

  /**
   * Execute a query and return results
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Object} { rows, columns, rowCount }
   */
  function query(sql, params = []) {
    const stmt = db.prepare(sql)
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all()

    return {
      rows,
      columns: stmt.columns().map((col) => ({
        name: col.name,
        type: col.type || 'unknown',
      })),
      rowCount: rows.length,
    }
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL statement
   * @param {Array} params - Statement parameters
   * @returns {Object} { changes, lastInsertRowid }
   */
  function execute(sql, params = []) {
    const stmt = db.prepare(sql)
    const info = params.length > 0 ? stmt.run(...params) : stmt.run()

    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid,
    }
  }

  /**
   * Execute multiple statements in a transaction
   * @param {Function} fn - Function that performs operations
   * @returns {*} Result from fn
   */
  function transaction(fn) {
    const tx = db.transaction(fn)
    return tx()
  }

  /**
   * Get database schema information
   * @returns {Object} Schema metadata
   */
  function introspect() {
    // Get all tables
    const tables = query(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view')
       AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    ).rows

    const schema = {
      tables: tables.map((table) => {
        // Get columns for this table
        const columns = query(`PRAGMA table_info(${table.name})`).rows.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1,
        }))

        // Get indexes
        const indexes = query(`PRAGMA index_list(${table.name})`).rows.map((idx) => ({
          name: idx.name,
          unique: idx.unique === 1,
          columns: query(`PRAGMA index_info(${idx.name})`).rows.map((c) => c.name),
        }))

        return {
          name: table.name,
          type: table.type,
          columns,
          indexes,
        }
      }),
    }

    return schema
  }

  /**
   * Execute a PRAGMA command
   * @param {string} pragma - PRAGMA statement
   * @returns {*} Result
   */
  function pragma(pragmaStr) {
    return db.pragma(pragmaStr)
  }

  /**
   * Close the database connection
   */
  function close() {
    db.close()
  }

  return {
    query,
    execute,
    transaction,
    introspect,
    pragma,
    close,
    // Expose raw db for advanced use
    _db: db,
  }
}
