import { routes } from '@bassline/core'

/**
 * Create propagator routes for reactive constraint networks.
 *
 * Propagators watch cells and fire immediately when inputs change.
 * Since cells are ACI, no scheduler is needed - propagators fire
 * synchronously and the network naturally terminates.
 *
 * Handlers are registered as factories that receive a context object.
 *
 * Built-in handlers:
 * - Basic: sum, product, passthrough, constant
 * - Reducers: min, max, average, concat, first, last
 * - Structural: pair, zip, unzip
 * - Transformers: map, pick, format, coerce
 * - Predicates: filter, when
 * - Composition: compose
 * - Arithmetic: negate, abs, round, floor, ceil, subtract, divide, modulo, power
 * - Comparison: eq, neq, gt, gte, lt, lte
 * - Logic: and, or, not, xor
 * - String: split, join, trim, uppercase, lowercase, strSlice, replace, match, startsWith, endsWith, includes
 * - Array: length, at, head, tail, init, reverse, sort, sortBy, unique, flatten, compact, take, drop, chunk
 * - Array Reducers: sumBy, countBy, groupBy, indexBy, minBy, maxBy
 * - Object: keys, values, entries, fromEntries, get, has, omit, defaults, merge
 * - Type Checking: isNull, isNumber, isString, isArray, isObject, typeOf
 * - Conditional: when, ifElse, cond
 * - Utility: identity, always, tap, defaultTo
 *
 * Resource structure:
 * - GET  /propagators           → list all propagators
 * - GET  /propagators/:name     → get propagator config
 * - PUT  /propagators/:name     → create/update propagator
 * - GET  /propagators/:name/fire → manually fire (for debugging)
 *
 * @param {object} options - Configuration
 * @param {object} options.bl - Bassline instance for reading/writing cells
 * @returns {object} Propagator routes and control functions
 */
export function createPropagatorRoutes(options = {}) {
  const { bl, onPropagatorKill } = options

  /** @type {Map<string, {inputs: string[], output: string, handler: function, handlerName: string, config: object, enabled: boolean}>} */
  const store = new Map()

  /** @type {Map<string, Set<string>>} cell URI → Set of propagator names */
  const watchers = new Map()

  /** @type {Map<string, function>} handler name → factory function */
  const handlerFactories = new Map()

  // Register built-in handler factories
  handlerFactories.set('sum', () => (...values) =>
    values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  )

  handlerFactories.set('product', () => (...values) =>
    values.reduce((a, b) => (a ?? 1) * (b ?? 1), 1)
  )

  handlerFactories.set('passthrough', () => (value) => value)

  handlerFactories.set('constant', (ctx) => () => ctx.value)

  // --- Reducers ---

  handlerFactories.set('min', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? Math.min(...nums) : null
  })

  handlerFactories.set('max', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? Math.max(...nums) : null
  })

  handlerFactories.set('average', () => (...values) => {
    const nums = values.filter(v => typeof v === 'number')
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  })

  handlerFactories.set('concat', () => (...values) => {
    if (Array.isArray(values[0])) return values.flat()
    return values.filter(v => v != null).join('')
  })

  handlerFactories.set('first', () => (...values) =>
    values.find(v => v != null)
  )

  handlerFactories.set('last', () => (...values) =>
    values.filter(v => v != null).pop()
  )

  // --- Structural ---

  handlerFactories.set('pair', () => (...values) => values)

  handlerFactories.set('zip', (ctx) => (...values) => {
    const keys = ctx.keys || values.map((_, i) => `v${i}`)
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]))
  })

  handlerFactories.set('unzip', (ctx) => (obj) => obj?.[ctx.key])

  // --- Transformers ---

  handlerFactories.set('map', (ctx) => {
    // Apply a named handler to each element of a collection (or single value)
    const innerHandler = getHandler(ctx.handler, ctx.config || {})
    if (!innerHandler) throw new Error(`map: unknown handler '${ctx.handler}'`)
    return (collection) => {
      if (!Array.isArray(collection)) return innerHandler(collection)
      return collection.map(item => innerHandler(item))
    }
  })

  handlerFactories.set('pick', (ctx) => (obj) => obj?.[ctx.key])

  handlerFactories.set('format', (ctx) => (...values) =>
    ctx.template.replace(/\{(\d+)\}/g, (_, i) => values[i] ?? '')
  )

  handlerFactories.set('coerce', (ctx) => (value) => {
    switch (ctx.to) {
      case 'number': return Number(value) || 0
      case 'string': return String(value ?? '')
      case 'boolean': return Boolean(value)
      case 'json': return typeof value === 'string' ? JSON.parse(value) : value
      default: return value
    }
  })

  // --- Predicates ---

  handlerFactories.set('filter', (ctx) => {
    // Use a named predicate handler - returns undefined to skip propagation
    const predHandler = getHandler(ctx.handler, ctx.config || {})
    if (!predHandler) throw new Error(`filter: unknown handler '${ctx.handler}'`)
    return (value) => predHandler(value) ? value : undefined
  })

  // --- Composition ---

  handlerFactories.set('compose', (ctx) => {
    // Chain multiple handlers: compose({steps: ['coerce', 'negate'], coerce: {to: 'number'}})
    const handlers = ctx.steps.map(step => {
      if (typeof step === 'string') {
        return getHandler(step, ctx[step] || {})
      }
      return getHandler(step.handler, step.config || {})
    })
    return (...values) => {
      let result = values.length === 1 ? values[0] : values
      for (const h of handlers) {
        result = Array.isArray(result) ? h(...result) : h(result)
      }
      return result
    }
  })

  // --- Arithmetic (single-input) ---

  handlerFactories.set('negate', () => (x) => -x)
  handlerFactories.set('abs', () => (x) => Math.abs(x))
  handlerFactories.set('round', () => (x) => Math.round(x))
  handlerFactories.set('floor', () => (x) => Math.floor(x))
  handlerFactories.set('ceil', () => (x) => Math.ceil(x))

  // --- Arithmetic (two-input) ---

  handlerFactories.set('subtract', () => (a, b) => a - b)
  handlerFactories.set('divide', () => (a, b) => b !== 0 ? a / b : null)
  handlerFactories.set('modulo', () => (a, b) => b !== 0 ? a % b : null)
  handlerFactories.set('power', () => (a, b) => Math.pow(a, b))

  // --- Comparison ---

  handlerFactories.set('eq', (ctx) => (a, b) => a === (b ?? ctx.value))
  handlerFactories.set('neq', (ctx) => (a, b) => a !== (b ?? ctx.value))
  handlerFactories.set('gt', (ctx) => (a, b) => a > (b ?? ctx.value))
  handlerFactories.set('gte', (ctx) => (a, b) => a >= (b ?? ctx.value))
  handlerFactories.set('lt', (ctx) => (a, b) => a < (b ?? ctx.value))
  handlerFactories.set('lte', (ctx) => (a, b) => a <= (b ?? ctx.value))

  // --- Logic ---

  handlerFactories.set('and', () => (...values) => values.every(Boolean))
  handlerFactories.set('or', () => (...values) => values.some(Boolean))
  handlerFactories.set('not', () => (x) => !x)
  handlerFactories.set('xor', () => (a, b) => Boolean(a) !== Boolean(b))

  // --- String Operations ---

  handlerFactories.set('split', (ctx) => (s) => String(s).split(ctx.delimiter ?? ','))
  handlerFactories.set('join', (ctx) => (arr) => arr.join(ctx.delimiter ?? ','))
  handlerFactories.set('trim', () => (s) => String(s).trim())
  handlerFactories.set('uppercase', () => (s) => String(s).toUpperCase())
  handlerFactories.set('lowercase', () => (s) => String(s).toLowerCase())
  handlerFactories.set('strSlice', (ctx) => (s) => String(s).slice(ctx.start ?? 0, ctx.end))
  handlerFactories.set('replace', (ctx) => (s) =>
    String(s).replace(new RegExp(ctx.pattern, ctx.flags ?? ''), ctx.replacement ?? '')
  )
  handlerFactories.set('match', (ctx) => (s) =>
    String(s).match(new RegExp(ctx.pattern, ctx.flags ?? ''))
  )
  handlerFactories.set('startsWith', (ctx) => (s) => String(s).startsWith(ctx.prefix))
  handlerFactories.set('endsWith', (ctx) => (s) => String(s).endsWith(ctx.suffix))
  handlerFactories.set('includes', (ctx) => (s) => String(s).includes(ctx.substring))

  // --- Array Operations ---

  handlerFactories.set('length', () => (arr) => Array.isArray(arr) ? arr.length : null)
  handlerFactories.set('at', (ctx) => (arr) => arr?.[ctx.index])
  handlerFactories.set('head', () => (arr) => arr?.[0])
  handlerFactories.set('tail', () => (arr) => arr?.slice(1))
  handlerFactories.set('init', () => (arr) => arr?.slice(0, -1))
  handlerFactories.set('reverse', () => (arr) => [...(arr || [])].reverse())
  handlerFactories.set('sort', (ctx) => (arr) =>
    [...(arr || [])].sort(ctx.descending ? (a, b) => b - a : (a, b) => a - b)
  )
  handlerFactories.set('sortBy', (ctx) => (arr) =>
    [...(arr || [])].sort((a, b) => {
      const va = a?.[ctx.key], vb = b?.[ctx.key]
      return ctx.descending ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1)
    })
  )
  handlerFactories.set('unique', () => (arr) => [...new Set(arr || [])])
  handlerFactories.set('flatten', () => (arr) => (arr || []).flat())
  handlerFactories.set('compact', () => (arr) => (arr || []).filter(x => x != null))
  handlerFactories.set('take', (ctx) => (arr) => arr?.slice(0, ctx.count))
  handlerFactories.set('drop', (ctx) => (arr) => arr?.slice(ctx.count))
  handlerFactories.set('chunk', (ctx) => (arr) => {
    const chunks = []
    const a = arr || []
    for (let i = 0; i < a.length; i += ctx.size) {
      chunks.push(a.slice(i, i + ctx.size))
    }
    return chunks
  })

  // --- Array Reducers (by key) ---

  handlerFactories.set('sumBy', (ctx) => (arr) =>
    (arr || []).reduce((sum, x) => sum + (x?.[ctx.key] ?? 0), 0)
  )
  handlerFactories.set('countBy', (ctx) => (arr) =>
    (arr || []).reduce((acc, x) => {
      const k = x?.[ctx.key]
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  )
  handlerFactories.set('groupBy', (ctx) => (arr) =>
    (arr || []).reduce((acc, x) => {
      const k = x?.[ctx.key]
      ;(acc[k] ??= []).push(x)
      return acc
    }, {})
  )
  handlerFactories.set('indexBy', (ctx) => (arr) =>
    Object.fromEntries((arr || []).map(x => [x?.[ctx.key], x]))
  )
  handlerFactories.set('minBy', (ctx) => (arr) =>
    (arr || []).reduce((min, x) => (x?.[ctx.key] < min?.[ctx.key] ? x : min), arr?.[0])
  )
  handlerFactories.set('maxBy', (ctx) => (arr) =>
    (arr || []).reduce((max, x) => (x?.[ctx.key] > max?.[ctx.key] ? x : max), arr?.[0])
  )

  // --- Object Operations ---

  handlerFactories.set('keys', () => (obj) => Object.keys(obj ?? {}))
  handlerFactories.set('values', () => (obj) => Object.values(obj ?? {}))
  handlerFactories.set('entries', () => (obj) => Object.entries(obj ?? {}))
  handlerFactories.set('fromEntries', () => (arr) => Object.fromEntries(arr ?? []))
  handlerFactories.set('get', (ctx) => (obj) =>
    ctx.path.split('.').reduce((o, k) => o?.[k], obj)
  )
  handlerFactories.set('has', (ctx) => (obj) =>
    ctx.path.split('.').reduce((o, k) => o?.[k], obj) !== undefined
  )
  handlerFactories.set('omit', (ctx) => (obj) =>
    Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !ctx.keys.includes(k)))
  )
  handlerFactories.set('defaults', (ctx) => (obj) => ({ ...ctx.defaults, ...(obj ?? {}) }))
  handlerFactories.set('merge', () => (...objs) => Object.assign({}, ...objs))

  // --- Type Checking ---

  handlerFactories.set('isNull', () => (x) => x == null)
  handlerFactories.set('isNumber', () => (x) => typeof x === 'number')
  handlerFactories.set('isString', () => (x) => typeof x === 'string')
  handlerFactories.set('isArray', () => (x) => Array.isArray(x))
  handlerFactories.set('isObject', () => (x) => x !== null && typeof x === 'object' && !Array.isArray(x))
  handlerFactories.set('typeOf', () => (x) => Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x)

  // --- Conditional ---

  handlerFactories.set('when', (ctx) => {
    const predHandler = getHandler(ctx.handler, ctx.config || {})
    if (!predHandler) throw new Error(`when: unknown handler '${ctx.handler}'`)
    return (value) => predHandler(value) ? value : undefined
  })

  handlerFactories.set('ifElse', (ctx) => {
    const pred = getHandler(ctx.predicate.handler, ctx.predicate.config || {})
    const thenH = getHandler(ctx.then.handler, ctx.then.config || {})
    const elseH = getHandler(ctx.else.handler, ctx.else.config || {})
    return (value) => pred(value) ? thenH(value) : elseH(value)
  })

  handlerFactories.set('cond', (ctx) => (value) => {
    for (const { when, then } of ctx.cases) {
      const pred = getHandler(when.handler, when.config || {})
      if (pred(value)) {
        return getHandler(then.handler, then.config || {})(value)
      }
    }
    return ctx.default
      ? getHandler(ctx.default.handler, ctx.default.config || {})(value)
      : value
  })

  // --- Utility ---

  handlerFactories.set('identity', () => (x) => x)
  handlerFactories.set('always', (ctx) => () => ctx.value)
  handlerFactories.set('tap', (ctx) => (x) => { console.log(ctx.label ?? 'tap', x); return x })
  handlerFactories.set('defaultTo', (ctx) => (x) => x ?? ctx.value)

  /**
   * Register a handler factory
   * @param {string} name - Handler name
   * @param {function} factory - Factory function (ctx) => handler
   */
  function registerHandler(name, factory) {
    handlerFactories.set(name, factory)
  }

  /**
   * Get a handler by creating it from a factory
   * @param {string} name - Handler name
   * @param {object} config - Config to pass to factory
   * @returns {function|null}
   */
  function getHandler(name, config = {}) {
    const factory = handlerFactories.get(name)
    if (!factory) return null
    return factory(config)
  }

  /**
   * Get a propagator by name
   * @param {string} name
   * @returns {object|null}
   */
  function getPropagator(name) {
    return store.get(name) || null
  }

  /**
   * Register a propagator
   * @param {string} name - Propagator name
   * @param {object} config - Propagator config
   * @param {string[]} config.inputs - Cell URIs to watch
   * @param {string} config.output - Cell URI to write to
   * @param {string} config.handler - Handler name (references a registered factory)
   * @param {object} [config.handlerConfig] - Config to pass to handler factory
   * @param {boolean} [config.enabled=true] - Whether propagator is active
   */
  function createPropagator(name, config) {
    const existing = store.get(name)

    // Unregister old watchers if updating
    if (existing) {
      for (const inputUri of existing.inputs) {
        watchers.get(inputUri)?.delete(name)
      }
    }

    // Resolve handler from factory
    const handlerName = config.handler || 'passthrough'
    const handlerConfig = config.handlerConfig || {}
    const handler = getHandler(handlerName, handlerConfig)

    if (!handler) {
      throw new Error(`Unknown handler: ${handlerName}`)
    }

    const propagator = {
      inputs: config.inputs || [],
      output: config.output,
      handler,
      handlerName,
      handlerConfig,
      enabled: config.enabled !== false
    }

    store.set(name, propagator)

    // Register watchers for each input
    for (const inputUri of propagator.inputs) {
      if (!watchers.has(inputUri)) {
        watchers.set(inputUri, new Set())
      }
      watchers.get(inputUri).add(name)
    }

    // Fire once on creation to compute initial value from existing inputs
    if (bl && propagator.inputs.length > 0) {
      fire(name).catch(err => {
        console.warn(`Propagator ${name} initial fire failed:`, err.message)
      })
    }

    return propagator
  }

  /**
   * Remove a propagator
   * @param {string} name
   */
  function removePropagator(name) {
    const propagator = store.get(name)
    if (propagator) {
      for (const inputUri of propagator.inputs) {
        watchers.get(inputUri)?.delete(name)
      }
      store.delete(name)
    }
  }

  /**
   * Kill (remove) a propagator with callback notification
   * @param {string} name - Propagator name
   * @returns {boolean} Whether the propagator existed and was removed
   */
  function killPropagator(name) {
    const existed = store.has(name)
    if (existed) {
      removePropagator(name)
      if (onPropagatorKill) {
        onPropagatorKill({ uri: `bl:///propagators/${name}` })
      }
    }
    return existed
  }

  /**
   * Fire a propagator - read inputs, call handler, write output
   * @param {string} name - Propagator name
   * @returns {Promise<{fired: boolean, result?: any}>}
   */
  async function fire(name) {
    const propagator = store.get(name)
    if (!propagator || !propagator.enabled) {
      return { fired: false }
    }

    if (!bl) {
      console.warn(`Propagator ${name}: no Bassline instance, cannot fire`)
      return { fired: false }
    }

    // Read all input values
    const inputValues = []
    for (const inputUri of propagator.inputs) {
      const result = await bl.get(`${inputUri}/value`)
      inputValues.push(result?.body)
    }

    // Call the handler
    let outputValue
    try {
      outputValue = propagator.handler(...inputValues)
    } catch (err) {
      console.error(`Propagator ${name} handler error:`, err)
      return { fired: false, error: err.message }
    }

    // Skip write if handler returns undefined (for filter semantics)
    if (outputValue === undefined) {
      return { fired: true, skipped: true }
    }

    // Write to output cell
    await bl.put(`${propagator.output}/value`, {}, outputValue)

    return { fired: true, result: outputValue }
  }

  /**
   * Handle cell change - fire all watching propagators
   * @param {string} cellUri - The cell that changed
   */
  async function onCellChange(cellUri) {
    const watching = watchers.get(cellUri)
    if (!watching) return

    for (const propagatorName of watching) {
      await fire(propagatorName)
    }
  }

  /**
   * List all propagators
   * @returns {string[]}
   */
  function listPropagators() {
    return [...store.keys()]
  }

  const propagatorRoutes = routes('/propagators', r => {
    // List all propagators
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listPropagators().map(name => ({
          name,
          type: 'propagator',
          uri: `bl:///propagators/${name}`
        }))
      }
    }))

    // Get a propagator
    r.get('/:name', ({ params }) => {
      const prop = getPropagator(params.name)
      if (!prop) return null

      return {
        headers: { type: 'bl:///types/propagator' },
        body: {
          inputs: prop.inputs,
          output: prop.output,
          handler: prop.handlerName,
          handlerConfig: prop.handlerConfig,
          enabled: prop.enabled
        }
      }
    })

    // Create/update a propagator
    r.put('/:name', ({ params, body }) => {
      const config = {
        inputs: body.inputs || [],
        output: body.output,
        handler: body.handler || 'passthrough',
        handlerConfig: body.handlerConfig || {},
        enabled: body.enabled !== false
      }

      const prop = createPropagator(params.name, config)

      return {
        headers: { type: 'bl:///types/propagator' },
        body: {
          inputs: prop.inputs,
          output: prop.output,
          handler: prop.handlerName,
          handlerConfig: prop.handlerConfig,
          enabled: prop.enabled
        }
      }
    })

    // Manually fire a propagator (for debugging)
    r.get('/:name/fire', async ({ params }) => {
      const result = await fire(params.name)
      return {
        headers: { type: 'bl:///types/propagator-result' },
        body: result
      }
    })

    // Kill (remove) a propagator
    r.put('/:name/kill', ({ params }) => {
      const existed = killPropagator(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///propagators/${params.name}` }
      }
    })
  })

  /**
   * Install propagator routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} blInstance
   */
  function install(blInstance) {
    blInstance.install(propagatorRoutes)
  }

  return {
    routes: propagatorRoutes,
    install,
    registerHandler,
    getPropagator,
    createPropagator,
    removePropagator,
    killPropagator,
    fire,
    onCellChange,
    listPropagators,
    listHandlers: () => [...handlerFactories.keys()],
    _store: store,
    _watchers: watchers,
    _handlers: handlerFactories
  }
}
