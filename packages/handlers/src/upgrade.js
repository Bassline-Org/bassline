/**
 * Handlers Upgrade Module
 *
 * Installs the handler system into a Bassline instance.
 */

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
 * Install handlers into a Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installHandlers(bl) {
  // Create registry
  const registry = createHandlerRegistry()

  // Create compiler and wire it up
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Register all handler modules
  registerModule(registry, math)
  registerModule(registry, logic)
  registerModule(registry, collections, { getPath: 'get' }) // Remap getPath -> get
  registerModule(registry, string)
  registerModule(registry, type)
  registerModule(registry, control)
  registerModule(registry, combinators)

  // Create and install routes
  const handlerRoutes = createHandlerRoutes({ registry, compile })
  bl.install(handlerRoutes)

  // Register on bl for other modules to use
  bl._handlers = {
    registry,
    compile,
    get: registry.get,
    getFactory: registry.getFactory,
    registerBuiltin: registry.registerBuiltin,
    registerCustom: registry.registerCustom,
    listAll: registry.listAll,
    listBuiltin: registry.listBuiltin,
    listCustom: registry.listCustom,
  }

  console.log(`Handlers installed: ${registry.listBuiltin().length} built-in handlers`)
}
