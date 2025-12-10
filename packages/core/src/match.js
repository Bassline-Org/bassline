/**
 * Match a pattern against a target object
 * Patterns are regex strings at leaves, objects for structure
 *
 * @param {string|RegExp|object} pattern - Pattern with regex strings at leaves
 * @param {*} target - Target to match against
 * @returns {boolean}
 *
 * @example
 * matchesPattern({ uri: '^bl:///data/.*' }, { uri: 'bl:///data/users/alice' })
 * // → true
 *
 * matchesPattern({ headers: { type: '^cell$' } }, { headers: { type: 'cell' } })
 * // → true
 */
export function matchesPattern(pattern, target) {
  // undefined/null pattern matches everything (wildcard)
  if (pattern === undefined || pattern === null) {
    return true
  }

  if (typeof pattern === 'string' || pattern instanceof RegExp) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    return typeof target === 'string' && regex.test(target)
  }

  if (typeof pattern !== 'object' || pattern === null) {
    return pattern === target
  }

  if (typeof target !== 'object' || target === null) {
    return false
  }

  for (const key of Object.keys(pattern)) {
    if (!matchesPattern(pattern[key], target[key])) {
      return false
    }
  }

  return true
}
