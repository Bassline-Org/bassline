import { createLinkIndex } from './links.js'

/**
 * Install link index into a Bassline instance.
 * Registers the link index on bl._links for other modules to use.
 * Sets up plumber rule for automatic cleanup when resources are removed.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default async function installLinks(bl) {
  const links = createLinkIndex()
  links.install(bl)
  bl._links = links

  // Wire up cleanup rule: when any resource is removed, clean up its links
  await bl.put(
    'bl:///plumb/rules/links-cleanup',
    {},
    {
      match: { port: 'resource-removed' },
      to: 'bl:///links/on-resource-removed',
    }
  )
}
