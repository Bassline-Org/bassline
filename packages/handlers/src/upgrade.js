/**
 * Handlers Upgrade Module
 *
 * Installs the handler system into a Bassline instance.
 */

import { createHandlerRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createHandlerRoutes } from './routes.js'

// Handler registration
import { registerReducers } from './handlers/reducers.js'
import { registerBinaryOps } from './handlers/binary-ops.js'
import { registerArithmetic } from './handlers/arithmetic.js'
import { registerComparison } from './handlers/comparison.js'
import { registerLogic } from './handlers/logic.js'
import { registerString } from './handlers/string.js'
import { registerArray } from './handlers/array.js'
import { registerArrayReducers } from './handlers/array-reducers.js'
import { registerObject } from './handlers/object.js'
import { registerType } from './handlers/type.js'
import { registerConditional } from './handlers/conditional.js'
import { registerStructural } from './handlers/structural.js'
import { registerUtility } from './handlers/utility.js'
import { registerComposition } from './handlers/composition.js'

// Combinator registration
import { registerUnaryCombinators } from './combinators/unary.js'
import { registerBinaryCombinators } from './combinators/binary.js'
import { registerTernaryCombinators } from './combinators/ternary.js'
import { registerVariadicCombinators } from './combinators/variadic.js'
import { registerSpecialCombinators } from './combinators/special.js'

/**
 * Install handlers into a Bassline instance.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 */
export default function installHandlers(bl, config = {}) {
  // Create registry
  const registry = createHandlerRegistry()

  // Create compiler and wire it up
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Register all built-in handlers
  const ctx = {
    registerBuiltin: registry.registerBuiltin,
    get: registry.get,
    getFactory: registry.getFactory
  }

  // Handlers by domain
  registerReducers(ctx)
  registerBinaryOps(ctx)
  registerArithmetic(ctx)
  registerComparison(ctx)
  registerLogic(ctx)
  registerString(ctx)
  registerArray(ctx)
  registerArrayReducers(ctx)
  registerObject(ctx)
  registerType(ctx)
  registerConditional(ctx)
  registerStructural(ctx)
  registerUtility(ctx)
  registerComposition(ctx)

  // Combinators
  registerUnaryCombinators(ctx)
  registerBinaryCombinators(ctx)
  registerTernaryCombinators(ctx)
  registerVariadicCombinators(ctx)
  registerSpecialCombinators(ctx)

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
    listCustom: registry.listCustom
  }

  console.log(`Handlers installed: ${registry.listBuiltin().length} built-in handlers`)
}
