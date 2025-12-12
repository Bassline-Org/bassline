import { resource } from '@bassline/core'

/**
 * Extract all refs from a value (recursively)
 * Looks for bl:// URIs and $ref markers
 *
 * @param {*} value - Value to scan for refs
 * @returns {string[]} Array of ref URIs found
 */
export function collectRefs(value) {
  const refs = []

  function walk(v) {
    if (typeof v === 'string' && v.startsWith('bl://')) {
      refs.push(v)
    } else if (v && typeof v === 'object') {
      if (v.$ref && typeof v.$ref === 'string') {
        refs.push(v.$ref)
      }
      for (const key of Object.keys(v)) {
        walk(v[key])
      }
    }
  }

  walk(value)
  return refs
}

/**
 * Create a link index that tracks forward and backward refs
 *
 * @returns {{ index: (uri: string, body: any) => void, routes: object }}
 *
 * @example
 * const links = createLinkIndex()
 * bl.install(links.routes)
 *
 * // Index refs when storing
 * links.index('bl:///cells/counter', { ref: 'bl:///types/cell' })
 *
 * // Query links
 * bl.get('bl:///links/from/cells/counter')
 * // → { body: { refs: ['bl:///types/cell'] } }
 *
 * bl.get('bl:///links/to/types/cell')
 * // → { body: { refs: ['bl:///cells/counter'] } }
 */
export function createLinkIndex() {
  // uri -> Set<uri> (what this points to)
  const from = new Map()
  // uri -> Set<uri> (what points to this)
  const to = new Map()

  /**
   * Index refs from a resource body
   * Call this after every PUT
   */
  function index(uri, body) {
    // Clear old forward links
    const oldRefs = from.get(uri)
    if (oldRefs) {
      for (const ref of oldRefs) {
        const backlinks = to.get(ref)
        if (backlinks) {
          backlinks.delete(uri)
          if (backlinks.size === 0) to.delete(ref)
        }
      }
    }

    // Extract and store new refs
    const refs = collectRefs(body)
    if (refs.length > 0) {
      from.set(uri, new Set(refs))

      // Update backlinks
      for (const ref of refs) {
        if (!to.has(ref)) to.set(ref, new Set())
        to.get(ref).add(uri)
      }
    } else {
      from.delete(uri)
    }
  }

  /**
   * Remove all links for a resource (call on DELETE)
   */
  function remove(uri) {
    index(uri, null)
  }

  /**
   * Get forward refs (what does this point to?)
   */
  function getFrom(uri) {
    return from.get(uri) ? [...from.get(uri)] : []
  }

  /**
   * Get backlinks (what points to this?)
   */
  function getTo(uri) {
    return to.get(uri) ? [...to.get(uri)] : []
  }

  const linkResource = resource(r => {
    // List all indexed resources
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: [
          { name: 'from', type: 'query', uri: 'bl:///links/from' },
          { name: 'to', type: 'query', uri: 'bl:///links/to' }
        ]
      }
    }))

    // Forward refs: what does this URI point to?
    r.get('/from/:uri*', ({ params }) => {
      const uri = 'bl:///' + params.uri
      const refs = getFrom(uri)
      return {
        headers: { type: 'bl:///types/link-set' },
        body: {
          source: uri,
          direction: 'from',
          refs
        }
      }
    })

    // Backlinks: what points to this URI?
    r.get('/to/:uri*', ({ params }) => {
      const uri = 'bl:///' + params.uri
      const refs = getTo(uri)
      return {
        headers: { type: 'bl:///types/link-set' },
        body: {
          target: uri,
          direction: 'to',
          refs
        }
      }
    })
  })

  /**
   * Create a tap function for automatic link indexing
   * Install this as a PUT tap to automatically index refs
   *
   * @returns {function}
   */
  function createTap() {
    return ({ uri, body, result }) => {
      // Only index successful writes
      if (result && body !== undefined) {
        index(uri, body)
      }
    }
  }

  /**
   * Install link index into a Bassline instance
   * Sets up both routes (for querying) and taps (for automatic indexing)
   *
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/links'] - Mount prefix
   */
  function install(bl, { prefix = '/links' } = {}) {
    bl.mount(prefix, linkResource)
    bl.tap('put', createTap())
  }

  return {
    index,
    remove,
    getFrom,
    getTo,
    routes: linkResource,
    createTap,
    install,
    // Expose internals for debugging
    _from: from,
    _to: to
  }
}
