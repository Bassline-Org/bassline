import { createWsServerRoutes } from './ws.js'

/**
 * Install WebSocket server routes into a Bassline instance.
 * Requires plumber to be installed first (bl._plumber).
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {number[]} [config.ports] - Ports to start servers on
 */
export default async function installWsServer(bl, config = {}) {
  const plumber = bl._plumber
  if (!plumber) {
    throw new Error('plumber must be installed before ws-server')
  }

  bl.install(createWsServerRoutes(plumber))

  // Bootstrap servers from config
  if (config.ports) {
    for (const port of config.ports) {
      await bl.put(`bl:///server/ws/${port}`, {}, {})
    }
  }
}
