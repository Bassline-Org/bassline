/**
 * Schema definitions for blit tables.
 * All blits have these core tables.
 */

export const SCHEMA = {
  _boot: `
    CREATE TABLE IF NOT EXISTS _boot (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `,
  _cells: `
    CREATE TABLE IF NOT EXISTS _cells (
      key TEXT PRIMARY KEY,
      lattice TEXT NOT NULL,
      value TEXT
    )
  `,
  _store: `
    CREATE TABLE IF NOT EXISTS _store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `,
  _fn: `
    CREATE TABLE IF NOT EXISTS _fn (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `,
}

/**
 * Initialize all blit tables in a database connection.
 * @param {object} conn - SQLite connection from @bassline/database
 */
export const initSchema = conn => {
  for (const ddl of Object.values(SCHEMA)) {
    conn.execute(ddl)
  }
}
