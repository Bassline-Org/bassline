/**
 * @bassline/handlers
 *
 * Handler registry and combinators for Bassline propagators.
 */

// Import all modules for local use
import { createHandlerRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createHandlerRoutes } from './routes.js'

// Handler registration functions
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

// Combinator registration functions
import { registerUnaryCombinators } from './combinators/unary.js'
import { registerBinaryCombinators } from './combinators/binary.js'
import { registerTernaryCombinators } from './combinators/ternary.js'
import { registerVariadicCombinators } from './combinators/variadic.js'
import { registerSpecialCombinators } from './combinators/special.js'

// Re-export all imports for external consumers
export {
  createHandlerRegistry,
  createCompiler,
  createHandlerRoutes,
  registerReducers,
  registerBinaryOps,
  registerArithmetic,
  registerComparison,
  registerLogic,
  registerString,
  registerArray,
  registerArrayReducers,
  registerObject,
  registerType,
  registerConditional,
  registerStructural,
  registerUtility,
  registerComposition,
  registerUnaryCombinators,
  registerBinaryCombinators,
  registerTernaryCombinators,
  registerVariadicCombinators,
  registerSpecialCombinators,
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

/**
 * Register all built-in handlers with a registry.
 * @param {object} registry - Handler registry
 */
export function registerAllHandlers(registry) {
  // Handlers by domain
  registry.registerAll(registerReducers)
  registry.registerAll(registerBinaryOps)
  registry.registerAll(registerArithmetic)
  registry.registerAll(registerComparison)
  registry.registerAll(registerLogic)
  registry.registerAll(registerString)
  registry.registerAll(registerArray)
  registry.registerAll(registerArrayReducers)
  registry.registerAll(registerObject)
  registry.registerAll(registerType)
  registry.registerAll(registerConditional)
  registry.registerAll(registerStructural)
  registry.registerAll(registerUtility)
  registry.registerAll(registerComposition)

  // Combinators
  registry.registerAll(registerUnaryCombinators)
  registry.registerAll(registerBinaryCombinators)
  registry.registerAll(registerTernaryCombinators)
  registry.registerAll(registerVariadicCombinators)
  registry.registerAll(registerSpecialCombinators)
}
