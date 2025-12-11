/**
 * Handler Compiler
 *
 * Compiles Hiccup-style handler definitions into executable functions.
 *
 * Format: [combinator, config?, ...args]
 * - If second element is plain object (not array), it's config
 * - Remaining elements are arguments (strings or nested arrays)
 *
 * Examples:
 *   'sum'                              → sum handler
 *   ['pipe', 'negate', 'abs']          → pipe(negate, abs)
 *   ['fork', 'identity', 'add', 'negate'] → fork(identity, add, negate)
 *   ['map', { handler: 'negate' }]     → map with config
 */

const MAX_DEPTH = 50

/**
 * Create a compiler function bound to a registry.
 *
 * @param {object} registry - Handler registry
 * @returns {function} Compiler function
 */
export function createCompiler(registry) {
  /**
   * Compile a Hiccup-style definition into a handler function.
   *
   * @param {any} def - Definition (string or array)
   * @param {number} [depth=0] - Current recursion depth (for protection)
   * @returns {function} Compiled handler
   */
  function compile(def, depth = 0) {
    // Prevent infinite recursion from self-referencing or circular handlers
    if (depth > MAX_DEPTH) {
      throw new Error(`Handler definition too deeply nested (max depth: ${MAX_DEPTH})`)
    }

    // String = primitive handler name
    if (typeof def === 'string') {
      // Check custom handlers first
      const custom = registry.getCustom(def)
      if (custom) return custom.compiled

      // Then built-in
      const factory = registry.getFactory(def)
      if (!factory) throw new Error(`Unknown handler: ${def}`)
      return factory({})
    }

    // Array = [combinator, config?, ...args]
    if (!Array.isArray(def)) {
      throw new Error(`Invalid definition: expected string or array, got ${typeof def}`)
    }

    const [name, ...rest] = def
    let config = {}
    let args = rest

    // If second element is plain object (not array), it's config
    if (rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0])) {
      config = rest[0]
      args = rest.slice(1)
    }

    // Recursively compile args
    const compiledArgs = args.map(arg => compile(arg, depth + 1))

    // Get factory and create handler with compiled args
    const factory = registry.getFactory(name)
    if (!factory) throw new Error(`Unknown combinator: ${name}`)

    return factory(config, ...compiledArgs)
  }

  return compile
}
