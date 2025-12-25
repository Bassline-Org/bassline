import { routes } from './resource.js'

/**
 * Wrap a resource to inject a specific kit into all calls.
 * @param {object} res - The resource to wrap
 * @param {object} kit - The kit to inject
 * @returns {object} Wrapped resource
 */
export const withKit = (res, kit) => ({
  get: h => res.get({ ...h, kit }),
  put: (h, b) => res.put({ ...h, kit }, b),
})

/**
 * Create a circuit from a spec and resources.
 *
 * A circuit is a wiring diagram that:
 * 1. Constructs a kit for each node based on bindings
 * 2. Wraps each node to inject its kit
 * 3. Exposes selected paths via ports
 *
 * Uses segment names (like routes), not paths:
 * bindings: { processor: { in: 'input' } }  // not '/in'
 * ports: { write: 'input' }                  // not '/write'
 * @param {object} spec - Circuit specification
 * @param {object} spec.bindings - Kit bindings for each node (segment → target)
 * @param {object} spec.ports - External port mappings (segment → node)
 * @param {object} resources - Map of node names to resources
 * @returns {object} A resource that routes through ports
 * @example
 * const c = circuit(
 *   {
 *     bindings: { processor: { in: 'input', out: 'output' } },
 *     ports: { write: 'input', run: 'processor', read: 'output' }
 *   },
 *   { input, processor, output }
 * )
 */
export const circuit = (spec, resources) => {
  const { bindings = {}, ports } = spec

  // Lazy proxy: defers to wrapped[name] at call time (resolves forward references)
  const lazyRef = name => ({
    get: h => wrapped[name].get(h),
    put: (h, b) => wrapped[name].put(h, b),
  })

  // Wrap each node with its constructed kit
  const wrapped = {}
  for (const [name, res] of Object.entries(resources)) {
    const nodeBindings = bindings[name] || {}

    // Build kit from bindings: { in: 'input' } → routes({ in: lazyRef('input') })
    // Uses lazy refs so forward references resolve correctly
    const kit =
      Object.keys(nodeBindings).length > 0
        ? routes(Object.fromEntries(Object.entries(nodeBindings).map(([seg, target]) => [seg, lazyRef(target)])))
        : undefined

    wrapped[name] = kit ? withKit(res, kit) : res
  }

  // Build port router
  return routes(Object.fromEntries(Object.entries(ports).map(([seg, node]) => [seg, wrapped[node]])))
}
