import { createHttpServerRoutes } from './http.js'

/**
 * Install HTTP server routes into a Bassline instance.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {number[]} [config.ports] - Ports to start servers on
 */
export default async function installHttpServer(bl, config = {}) {
  bl.install(createHttpServerRoutes())

  // Bootstrap servers from config
  if (config.ports) {
    for (const port of config.ports) {
      await bl.put(`bl:///server/http/${port}`, {}, {})
    }
  }
}
