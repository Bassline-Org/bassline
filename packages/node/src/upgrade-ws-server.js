import { createWsServerRoutes } from './ws.js'

/**
 * Install WebSocket server routes into a Bassline instance.
 * Waits for plumber module to be available via late binding.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {number[]} [config.ports] - Ports to start servers on
 */
export default async function installWsServer(bl, config = {}) {
  const plumber = await bl.getModule('plumber')

  const wsRoutes = createWsServerRoutes(plumber)
  wsRoutes.install(bl)
  bl.setModule('ws-server', {})

  // Bootstrap servers from config
  if (config.ports) {
    for (const port of config.ports) {
      await bl.put(`bl:///server/ws/${port}`, {}, {})
    }
  }
}
