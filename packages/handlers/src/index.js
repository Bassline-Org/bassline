/**
 * @module @bassline/handlers
 *
 * Handler registry and combinators for Bassline propagators.
 */

// Core modules
import { createHandlerRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createHandlerRoutes } from './routes.js'

// Handler modules (named exports)
import * as math from './handlers/math.js'
import * as logic from './handlers/logic.js'
import * as collections from './handlers/collections.js'
import * as string from './handlers/string.js'
import * as type from './handlers/type.js'
import * as control from './handlers/control.js'
import * as combinators from './combinators.js'

// Re-export core modules
export { createHandlerRegistry, createCompiler, createHandlerRoutes }

// Re-export handler modules for direct access
export { math, logic, collections, string, type, control, combinators }

/**
 * Register all exports from a module as handlers.
 * @param {object} registry - Handler registry
 * @param {object} mod - Module with named exports
 * @param {object} [nameMap] - Optional name remapping (exportName -> handlerName)
 */
function registerModule(registry, mod, nameMap = {}) {
  for (const [exportName, factory] of Object.entries(mod)) {
    const handlerName = nameMap[exportName] || exportName
    registry.registerBuiltin(handlerName, factory)
  }
}

/**
 * Register all built-in handlers with a registry.
 * @param {object} registry - Handler registry
 */
export function registerAllHandlers(registry) {
  registerModule(registry, math)
  registerModule(registry, logic)
  registerModule(registry, collections, { getPath: 'get' }) // Remap getPath -> get
  registerModule(registry, string)
  registerModule(registry, type)
  registerModule(registry, control)
  registerModule(registry, combinators)
}

/**
 * Create a fully configured handler system.
 * @returns {object} Handler system with registry, compiler, and routes
 */
export function createHandlerSystem() {
  const registry = createHandlerRegistry()
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Register all built-in handlers
  registerAllHandlers(registry)

  const routes = createHandlerRoutes({ registry, compile })

  return {
    registry,
    compile,
    routes,
  }
}
