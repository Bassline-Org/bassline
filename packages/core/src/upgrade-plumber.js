import { createPlumber } from './plumber.js'

/**
 * Install plumber into a Bassline instance.
 * Registers the plumber on bl._plumber for other modules to use.
 *
 * @param {import('./bassline.js').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {object} [config.rules] - Initial rules to add { name: { match, port } }
 */
export default function installPlumber(bl, config = {}) {
  const plumber = createPlumber()
  plumber.install(bl)
  bl._plumber = plumber

  // Apply initial rules from config
  if (config.rules) {
    for (const [name, rule] of Object.entries(config.rules)) {
      plumber.addRule(name, rule)
    }
  }
}
