import { createLinkIndex } from './links.js'

/**
 * Install link index into a Bassline instance.
 * Registers the link index on bl._links for other modules to use.
 *
 * @param {import('./bassline.js').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options (unused)
 */
export default function installLinks(bl, config = {}) {
  const links = createLinkIndex()
  links.install(bl)
  bl._links = links
}
