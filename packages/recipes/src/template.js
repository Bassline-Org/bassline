/**
 * Template substitution for recipe parameters.
 *
 * Supports:
 * - ${paramName} - Substitute parameter value
 * - ${ref.id} - Substitute reference to created resource URI
 */

/**
 * Substitute template variables in a value.
 * Recursively handles strings, arrays, and objects.
 *
 * @param {any} value - Value to substitute in
 * @param {object} context - Substitution context
 * @param {object} context.params - Parameter values
 * @param {object} context.ref - Created resource references by id
 * @returns {any} Value with substitutions applied
 */
export function substitute(value, context) {
  if (typeof value === 'string') {
    return substituteString(value, context)
  }

  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, context))
  }

  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = substitute(val, context)
    }
    return result
  }

  return value
}

/**
 * Substitute template variables in a string.
 *
 * @param {string} str - String to substitute in
 * @param {object} context - Substitution context
 * @returns {any} String with substitutions, or raw value if entire string is single placeholder
 */
function substituteString(str, context) {
  // If entire string is a single placeholder, return raw value (preserves type)
  const singleMatch = str.match(/^\$\{([^}]+)\}$/)
  if (singleMatch) {
    const value = resolvePath(singleMatch[1], context)
    if (value === undefined) {
      throw new Error(`Template variable not found: ${singleMatch[1]}`)
    }
    return value
  }

  // Otherwise do normal string replacement
  return str.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const value = resolvePath(path, context)
    if (value === undefined) {
      throw new Error(`Template variable not found: ${path}`)
    }
    return String(value)
  })
}

/**
 * Resolve a dot-separated path in the context.
 *
 * @param {string} path - Dot-separated path (e.g., 'ref.count', 'params.name')
 * @param {object} context - Substitution context
 * @returns {any} Resolved value
 */
function resolvePath(path, context) {
  // Handle direct param access (e.g., ${name} -> context.params.name)
  if (!path.includes('.')) {
    return context.params?.[path]
  }

  // Handle path access (e.g., ${ref.count} or ${params.name})
  const parts = path.split('.')
  let current = context

  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }

  return current
}

/**
 * Validate that all required parameters are provided.
 *
 * @param {object} paramDefs - Parameter definitions from recipe
 * @param {object} params - Provided parameter values
 * @returns {object} Resolved parameters with defaults applied
 * @throws {Error} If required parameter is missing
 */
export function validateParams(paramDefs, params) {
  const resolved = {}

  for (const [name, def] of Object.entries(paramDefs || {})) {
    if (name in params) {
      resolved[name] = params[name]
    } else if ('default' in def) {
      resolved[name] = def.default
    } else if (def.required) {
      throw new Error(`Missing required parameter: ${name}`)
    }
  }

  // Include any extra params not in definitions
  for (const [name, value] of Object.entries(params)) {
    if (!(name in resolved)) {
      resolved[name] = value
    }
  }

  return resolved
}
