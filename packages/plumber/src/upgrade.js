import { createPlumber } from './plumber.js'

/**
 * Install plumber into a Bassline instance.
 * Registers the plumber via bl.setModule('plumber', ...) for late binding.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {object} [config.rules] - Initial rules to add { name: { match, to } }
 */
export default async function installPlumber(bl, config = {}) {
  const plumber = createPlumber()
  plumber.install(bl)
  bl.setModule('plumber', plumber)
  // Keep _plumber for backward compat with bl.plumb() which checks this
  bl._plumber = plumber

  // Apply initial rules from config via resource API
  if (config.rules) {
    for (const [name, rule] of Object.entries(config.rules)) {
      await bl.put(`bl:///plumb/rules/${name}`, {}, rule)
    }
  }
}
