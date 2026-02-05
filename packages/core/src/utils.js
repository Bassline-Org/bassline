// generic panic fn so bc throwing looks ugly often
export const panic = (msg, ...ctx) => {
  throw new Error(`[panic] msg=[${msg}] context=[${ctx}]`)
}
export const log = (...args) => console.log(...args)

// hookable produces a method we can hook into
export const HOOKABLE = Symbol.for('HOOKABLE')
export const hookable = fn => {
  if (fn[HOOKABLE]) return fn
  const hooks = {
    onBefore: [],
    onAfter: [],
  }
  const include = (hook, val) => {
    hooks[hook] = [...hooks[hook], val]
    return () => (hooks[hook] = hooks[hook].filter(v => v !== val))
  }
  function wrapped(...args) {
    const onExit = ctx => console.log('exiting: ', ctx)
    const ctx = { args, onExit }
    for (const before of hooks.onBefore) {
      before.call(this, ctx)
      if (ctx.exit) return ctx.onExit(ctx)
    }
    ctx.result = fn.call(this, ...ctx.args)
    for (const after of hooks.onAfter) {
      after.call(this, ctx)
      if (ctx.exit) return ctx.onExit(ctx)
    }
    return ctx.result
  }
  wrapped[HOOKABLE] = true
  wrapped.before = f => include('onBefore', f)
  wrapped.after = f => include('onAfter', f)
  return wrapped
}

export const putKit = (req, { body, headers }) => req.headers?.kit?.put?.(body, headers)

export const hookify = aResource =>
  Object.assign(aResource, {
    get: hookable(aResource.get),
    put: hookable(aResource.put),
  })

export const ref = init => {
  let _ref = init
  return [() => _ref, value => ((_ref = value), _ref)]
}
