import { createFileStore } from './file-store.js'

/**
 * Install file store into a Bassline instance.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {string} [config.dataDir] - Data directory (default: BL_DATA env or '.bassline')
 * @param {string} [config.prefix] - Route prefix (default: '/data')
 */
export default function installFileStore(bl, config = {}) {
  const dataDir = config.dataDir || process.env.BL_DATA || '.bassline'
  const prefix = config.prefix || '/data'
  bl.install(createFileStore(dataDir, prefix))
}
