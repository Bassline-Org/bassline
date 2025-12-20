import { resource, routes, bind } from '@bassline/core'
import { Runtime } from './runtime.js'

// Create a shell resource that wraps a Runtime
export function createShell(opts = {}) {
  const rt = new Runtime()

  // Register built-in commands
  rt.register('set', ([name, val], r) => r.setVar(name, val))
  rt.register('puts', ([msg]) => msg)
  rt.register('pwd', (_, r) => r.pwd())
  rt.register('cd', ([path], r) => r.enter(path))
  rt.register('expr', args => args.map(Number).reduce((a, b) => a + b, 0))

  // get/put commands delegate to kit
  rt.register('get', async ([path], r, h) => {
    if (!h.kit) throw new Error('No kit available')
    const result = await h.kit.get({ path })
    return result.body
  })

  rt.register('put', async (args, r, h) => {
    if (!h.kit) throw new Error('No kit available')
    const path = args[0]
    const body = args.length > 1 ? args[1] : null
    const result = await h.kit.put({ path }, body)
    return result.body
  })

  // Apply custom command registrations
  if (opts.commands) {
    for (const [name, fn] of Object.entries(opts.commands)) {
      rt.register(name, fn)
    }
  }

  return routes({
    // GET / - shell info
    '': resource({
      get: async () => ({
        headers: { type: '/types/shell' },
        body: {
          pwd: rt.pwd(),
          description: 'Tcl-inspired shell for Bassline',
        },
      }),
    }),

    // PUT /eval - evaluate a script
    eval: resource({
      put: async (h, script) => {
        try {
          const result = await rt.run(script)
          return {
            headers: { status: 200 },
            body: { result },
          }
        } catch (err) {
          return {
            headers: { status: 400, condition: 'error' },
            body: { error: err.message },
          }
        }
      },
    }),

    // PUT /subst - apply substitutions only
    subst: resource({
      put: async (h, src) => {
        try {
          const result = rt.subst(src)
          return {
            headers: { status: 200 },
            body: { result },
          }
        } catch (err) {
          return {
            headers: { status: 400, condition: 'error' },
            body: { error: err.message },
          }
        }
      },
    }),

    // GET/PUT /vars/:name - direct variable access
    vars: bind(
      'name',
      resource({
        get: async h => {
          try {
            const value = rt.getVar(h.params.name)
            return { headers: {}, body: value }
          } catch {
            return { headers: { status: 404, condition: 'not-found' }, body: null }
          }
        },
        put: async (h, value) => {
          rt.setVar(h.params.name, value)
          return { headers: {}, body: value }
        },
      })
    ),

    // PUT /cd - change directory
    cd: resource({
      put: async (h, path) => {
        const newPath = rt.enter(path)
        return { headers: {}, body: { path: newPath } }
      },
    }),
  })
}
