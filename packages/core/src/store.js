import { resource, routes, bind, splitPath } from './resource.js'

/**
 * Create an in-memory store resource.
 *
 * API (same as file store and all other stores):
 *   GET { path: '/foo/bar' }     → { headers: {}, body: <value> }
 *   PUT { path: '/foo/bar' }, v  → { headers: {}, body: v }
 *   GET { path: '/foo' }         → { headers: {}, body: [children...] } (if directory-like)
 *
 * @param {object} initial - Initial data (nested object structure)
 */
export const createMemoryStore = (initial = {}) => {
  const data = { ...initial }

  const getByPath = (path) => {
    const parts = (path ?? '').split('/').filter(Boolean)
    let current = data
    for (const part of parts) {
      if (current === undefined || current === null) return undefined
      current = current[part]
    }
    return current
  }

  const setByPath = (path, value) => {
    const parts = (path ?? '').split('/').filter(Boolean)
    if (parts.length === 0) return false

    let current = data
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) current[part] = {}
      current = current[part]
    }
    current[parts[parts.length - 1]] = value
    return true
  }

  return resource({
    get: async (h) => {
      const value = getByPath(h.path)
      if (value === undefined) {
        return { headers: { condition: 'not-found' }, body: null }
      }
      // If it's an object with children, return keys (directory-like)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return { headers: { type: 'directory' }, body: Object.keys(value) }
      }
      return { headers: {}, body: value }
    },

    put: async (h, body) => {
      setByPath(h.path, body)
      return { headers: {}, body }
    }
  })
}

export default createMemoryStore
