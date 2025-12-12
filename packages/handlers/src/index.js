/**
 * @bassline/handlers
 *
 * Handler registry and combinators for Bassline propagators.
 */

export { createHandlerRegistry } from './registry.js'
export { createCompiler } from './compiler.js'
export { createHandlerRoutes } from './routes.js'

// Handler registration functions
export { registerReducers } from './handlers/reducers.js'
export { registerBinaryOps } from './handlers/binary-ops.js'
export { registerArithmetic } from './handlers/arithmetic.js'
export { registerComparison } from './handlers/comparison.js'
export { registerLogic } from './handlers/logic.js'
export { registerString } from './handlers/string.js'
export { registerArray } from './handlers/array.js'
export { registerArrayReducers } from './handlers/array-reducers.js'
export { registerObject } from './handlers/object.js'
export { registerType } from './handlers/type.js'
export { registerConditional } from './handlers/conditional.js'
export { registerStructural } from './handlers/structural.js'
export { registerUtility } from './handlers/utility.js'
export { registerComposition } from './handlers/composition.js'

// Combinator registration functions
export { registerUnaryCombinators } from './combinators/unary.js'
export { registerBinaryCombinators } from './combinators/binary.js'
export { registerTernaryCombinators } from './combinators/ternary.js'
export { registerVariadicCombinators } from './combinators/variadic.js'
export { registerSpecialCombinators } from './combinators/special.js'

/**
 * Create a fully configured handler system.
 *
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
 *
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
