/**
 * Function Upgrade Module
 *
 * Installs the function system into a Bassline instance.
 */

import { createFnRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createFnRoutes } from './routes.js'

// Function modules (named exports)
import * as math from './handlers/math.js'
import * as logic from './handlers/logic.js'
import * as collections from './handlers/collections.js'
import * as string from './handlers/string.js'
import * as type from './handlers/type.js'
import * as control from './handlers/control.js'
import * as combinators from './combinators.js'

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
 * Install functions into a Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installFn(bl) {
  // Create registry
  const registry = createFnRegistry()

  // Create compiler and wire it up
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Register all function modules with bl:///fn/ prefix
  registerModule(registry, math)
  registerModule(registry, logic)
  registerModule(registry, collections, { getPath: 'get' }) // Remap getPath -> get
  registerModule(registry, string)
  registerModule(registry, type)
  registerModule(registry, control)
  registerModule(registry, combinators)

  // Create and install routes at /fn
  const fnRoutes = createFnRoutes({ registry, compile })
  bl.install(fnRoutes)

  // Register as module for late binding (keep 'handlers' name for backward compat)
  const fn = {
    registry,
    compile,
    get: registry.get,
    getSync: registry.getSync,
    getFactory: registry.getFactory,
    registerBuiltin: registry.registerBuiltin,
    registerCustom: registry.registerCustom,
    listAll: registry.listAll,
    listBuiltin: registry.listBuiltin,
    listCustom: registry.listCustom,
  }

  // Register under both names for compatibility
  bl.setModule('fn', fn)
  bl.setModule('handlers', fn) // Backward compatibility

  console.log(`Functions installed: ${registry.listBuiltin().length} built-in functions`)
}
