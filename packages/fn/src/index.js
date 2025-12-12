/**
 * @module @bassline/fn
 *
 * Function registry and combinators for Bassline propagators.
 */

// Core modules
import { createFnRegistry, createHandlerRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createFnRoutes, createHandlerRoutes } from './routes.js'

// Function modules (named exports)
import * as math from './handlers/math.js'
import * as logic from './handlers/logic.js'
import * as collections from './handlers/collections.js'
import * as string from './handlers/string.js'
import * as type from './handlers/type.js'
import * as control from './handlers/control.js'
import * as combinators from './combinators.js'

// Re-export core modules (new names)
export { createFnRegistry, createCompiler, createFnRoutes }

// Re-export old names for backward compatibility
export { createHandlerRegistry, createHandlerRoutes }

// Re-export function modules for direct access
export { math, logic, collections, string, type, control, combinators }

/**
 * Register all exports from a module as functions.
 * @param {object} registry - Function registry
 * @param {object} mod - Module with named exports
 * @param {object} [nameMap] - Optional name remapping (exportName -> fnName)
 */
function registerModule(registry, mod, nameMap = {}) {
  for (const [exportName, factory] of Object.entries(mod)) {
    const fnName = nameMap[exportName] || exportName
    // Register with full URI
    registry.registerBuiltin(`bl:///fn/${fnName}`, factory)
  }
}

/**
 * Register all built-in functions with a registry.
 * @param {object} registry - Function registry
 */
export function registerAllFns(registry) {
  registerModule(registry, math)
  registerModule(registry, logic)
  registerModule(registry, collections, { getPath: 'get' }) // Remap getPath -> get
  registerModule(registry, string)
  registerModule(registry, type)
  registerModule(registry, control)
  registerModule(registry, combinators)
}

// Keep old name for backward compatibility
export const registerAllHandlers = registerAllFns

/**
 * Create a fully configured function system.
 * @returns {object} Function system with registry, compiler, and routes
 */
export function createFnSystem() {
  const registry = createFnRegistry()
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Register all built-in functions
  registerAllFns(registry)

  const routes = createFnRoutes({ registry, compile })

  return {
    registry,
    compile,
    routes,
  }
}

// Keep old name for backward compatibility
export const createHandlerSystem = createFnSystem
