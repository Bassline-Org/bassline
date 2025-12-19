import { resource, routes, bind } from './resource.js'

/**
 * Create a propagators resource for reactive computation
 *
 * Propagators read inputs, apply a function, and write to output.
 * All access is via kit with semantic paths:
 *   /inputs/:name  → read input value
 *   /fn            → get the function to apply
 *   /output        → write the result
 *
 * Routes:
 *   GET  /           → bassline describing propagators
 *   GET  /:name      → get propagator config
 *   PUT  /:name      → create propagator { inputs: [...], output, fn }
 *   PUT  /:name/run  → execute the propagator
 */
export const createPropagators = () => {
  const propagators = new Map()

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'propagators',
          description: 'Reactive computation between cells',
          resources: Object.fromEntries([...propagators.keys()].map(k => [`/${k}`, {}]))
        }
      })
    }),

    unknown: bind('name', routes({
      '': resource({
        get: async (h) => {
          const prop = propagators.get(h.params.name)
          if (!prop) return { headers: { condition: 'not-found' }, body: null }
          return { headers: { type: '/types/propagator' }, body: prop }
        },
        put: async (h, body) => {
          propagators.set(h.params.name, body)
          return { headers: {}, body }
        }
      }),

      run: resource({
        put: async (h) => {
          const prop = propagators.get(h.params.name)
          if (!prop) return { headers: { condition: 'not-found' }, body: null }
          if (!h.kit) return { headers: { condition: 'error', message: 'no kit' }, body: null }

          // Get all input values via kit (semantic paths)
          const inputValues = await Promise.all(
            prop.inputs.map(name => h.kit.get({ path: `/inputs/${name}` }))
          )

          // Get the function via kit
          const fnResult = await h.kit.get({ path: '/fn' })
          const fn = fnResult.body

          if (typeof fn !== 'function') {
            return { headers: { condition: 'error', message: 'fn is not a function' }, body: null }
          }

          // Compute result
          const result = fn(...inputValues.map(r => r.body))

          // Write to output via kit
          await h.kit.put({ path: '/output' }, result)

          return { headers: {}, body: { computed: true, result } }
        }
      })
    }))
  })
}

export default createPropagators
