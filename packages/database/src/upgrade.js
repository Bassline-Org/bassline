import { createDatabaseRoutes } from './database.js'

/**
 * Install database service into Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} config - Configuration options
 * @param {string} config.defaultConnection - Default connection name
 * @param {string} config.defaultPath - Default SQLite database path
 */
export default function installDatabase(bl, config = {}) {
  const { defaultConnection = 'main', defaultPath = process.env.BL_DATABASE || '.data/db.sqlite' } =
    config

  // Create database routes
  const database = createDatabaseRoutes({ bl })
  database.install(bl)

  // Create default connection if path provided
  if (defaultPath) {
    bl.put(
      `bl:///database/connections/${defaultConnection}`,
      {},
      {
        path: defaultPath,
      }
    ).catch((err) => {
      console.warn(`Failed to create default database connection: ${err.message}`)
    })
  }

  bl.setModule('database', database)

  console.log('Database service installed')
}
