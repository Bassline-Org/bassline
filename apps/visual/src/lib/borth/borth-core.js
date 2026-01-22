let _gensymCount = 0
export const gensym = (name = 'GENERATED') => `'@@GENSYM'__${name}__${_gensymCount++}`

export const tracing = {
  active: true,
  log(...args) {
    this.active && console.log(...args)
  },
  warn(...args) {
    this.active && console.warn(...args)
  },
}

export const WS = ' \t\n\r'
export const isWS = c => WS.includes(c)

const panic = (msg, label = 'panic') => {
  throw new Error(`${label}: ${msg}`)
}
const assert = (cond, msg) => cond || panic(`Assertion failed! ${msg}`, 'assert')

export const nary = (...fns) => {
  const impls = fns.reduce((acc, f) => ({ ...acc, [f.length]: f }), {})
  return (...args) => {
    const impl = impls[args.length]
    if (!impl) panic(`no implemented for ${args.length} arguments!`)
    return impl(...args)
  }
}

export const naryGS = key => {
  const f = nary(
    obj => obj[key],
    (obj, value) => ((obj[key] = value), obj),
    (obj, value, replace) => {
      const original = f(obj)
      return original === undefined ? f(obj, value) : f(obj, replace(original, value))
    }
  )
  return f
}

export const castArr = v => {
  if (Array.isArray(v)) return v
  if (v === undefined || v === null) return []
  return [v]
}

export const pop = (ctx, n = 1) => {
  if (n === 0) return []
  const s = ctx.stack
  assert(s.length >= n, 'stack underflow')
  assert(n > 0, `n must be greater than 0, got: ${n}`)
  return s.splice(s.length - n, n)
}
export const push = (ctx, ...items) => (ctx.stack.push(...items), ctx)

export const nextToken = ctx => {
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  if (ctx.pos >= ctx.src.length) return undefined
  const start = ctx.pos
  while (ctx.pos < ctx.src.length && !isWS(ctx.src[ctx.pos])) ctx.pos++
  return ctx.src.slice(start, ctx.pos)
}
export const parseUntil = (ctx, stopToken) => {
  const start = ctx.pos
  let next
  while ((next = nextToken(ctx))) {
    if (next === stopToken) {
      // remove 1 extra token because of leading whitespace for tokens
      const stop = ctx.pos - stopToken.length - 1
      return ctx.src.slice(start, stop)
    }
  }
  panic(`unmatched delimiter, expected: ${stopToken}`)
}

const currentScope = ctx => ctx.scope.at(-1)
const stage = (ctx, ...items) => {
  const current = currentScope(ctx)
  current.staging.push(...items)
  return ctx
}
const enterCompilationScope = (ctx, onExit) => {
  const scope = {
    staging: [],
    startPos: ctx.pos,
    onExit,
  }
  ctx.scope.push(scope)
  return ctx
}
const exitCompilationScope = async ctx => {
  const { onExit, ...scope } = ctx.scope.pop()
  scope.stopPos = ctx.pos
  assert(scope, `failed to exit compilation scope`)
  const current = currentScope(ctx)
  const toStage = castArr(await onExit(ctx, scope))
  if (current) {
    await stage(ctx, ...toStage)
  }
  return toStage
}

export const find = (ctx, name) => {
  if (ctx.ns.has(name)) return ctx.ns.get(name)
  const num = Number(name)
  if (!isNaN(num)) return constant(num)
  panic(`unknown: ${name}`)
}
export const define = (ctx, word) => {
  let name = props(word).name
  if (!name) {
    name = gensym()
    tracing.log('[define] generating name: ', name)
    props(word, { name })
  }
  let defined
  if (ctx.ns.has(name)) {
    const w = ctx.ns.get(name)
    tracing.log('[define] updating: ', name)
    impl(w, word.impl)
    w.props = word.props
    defined = w
  } else {
    tracing.log('[define] creating: ', name)
    ctx.ns.set(name, word)
    defined = word
  }
  return defined
}

export const word = nary(
  () => word(_ctx => panic('No implementation!'), {}),
  fn => word(fn, {}),
  (fn, props) => ({
    props,
    impl: fn,
    async exec(ctx) {
      return this.impl(await ctx)
    },
  })
)
export const impl = nary(
  word => word.impl ?? panic(`No impl on: ${word}`),
  (word, fn) => ((word.impl = fn), word)
)
export const props = nary(
  word => word.props ?? panic(`No properties on: ${word}`),
  (word, obj) => {
    if (typeof obj === 'function') {
      const f = obj
      word.props = { ...f(word.props) }
    } else {
      word.props = { ...word.props, ...obj }
    }
    return word
  }
)

export const stackify = fn => async ctx => {
  const args = await pop(ctx, fn.length)
  const result = castArr(await fn(...args)).filter(v => v !== undefined)
  return push(ctx, ...result)
}

export const constant = value =>
  word(
    stackify(() => [value]),
    { type: 'constant' }
  )
export const variable = initial => {
  const w = word(
    stackify(() => [props(w).slot]),
    { type: 'variable', slot: initial }
  )
  return w
}
export const def = fn => word(stackify(fn), { type: 'primitive' })
export const syn = fn => word(fn, { type: 'syntax', parsing: true })
export const docol = (name, words, additionalProps) => {
  const w = word(
    async c => {
      const { words } = props(w)
      for (const subword of words) {
        await subword.exec(c)
      }
      return c
    },
    { type: 'compiled', name, words, ...additionalProps }
  )
  return w
}

export const compile = async (ctx, source) => {
  let compCtx = { ...ctx, src: source, pos: 0, stack: undefined }
  enterCompilationScope(compCtx, (ctx, { staging }) => staging)
  let name
  while ((name = nextToken(compCtx)) !== undefined) {
    const word = find(compCtx, name)
    const { parsing } = props(word)
    if (parsing) {
      compCtx = await word.exec(compCtx)
    } else {
      await stage(compCtx, word)
    }
  }
  return await exitCompilationScope(compCtx)
}

export const evaluate = async (ctx, compiled) => {
  for (const w of compiled) {
    ctx = await w.exec(await ctx)
  }
}

export const run = async (ctx, source) => {
  const compiled = await compile(ctx, source)
  await evaluate(ctx, compiled)
  return ctx
}

export const freshContext = () => {
  const scratch = new Map()
  const ctx = {
    ns: scratch,
    vocabs: { scratch },
    stack: [],
    scope: [],
  }
  return ctx
}

const c = freshContext()

const colonDef = syn(c => {
  const start = c.pos
  const name = nextToken(c)
  enterCompilationScope(c, async (ctx, { staging }) => {
    // with definitions, we don't stage anything
    await define(ctx, await docol(name, staging))
  })
  currentScope(c).startPos = start
  return c
})
const syntaxDef = syn(c => {
  const start = c.pos
  const name = nextToken(c)
  enterCompilationScope(c, async (ctx, { staging }) => {
    // with definitions, we don't stage anything
    await define(ctx, await docol(name, staging, { parsing: true }))
  })
  currentScope(c).startPos = start
  return c
})
const delim = syn(async c => {
  await exitCompilationScope(c)
  return c
})

const scratch = new Map()
scratch.set(':', colonDef)
scratch.set('syn: ', syntaxDef)
scratch.set(';', delim)
scratch.set(
  '\\',
  syn(c => {
    const name = nextToken(c)
    const w = find(w, name)
    currentScope(c).parts.push(constant(w))
  })
)
scratch.set(
  '+',
  def((a, b) => [a + b])
)
scratch.set(
  '.',
  def(a => {
    console.log(a)
  })
)
scratch.set('bar', constant(10))
scratch.set('baz', constant(20))

c.ns = scratch
c.vocabs['scratch'] = scratch

const s = `
  : bar baz 69 ;

  : foo baz baz ;

  foo + .
`

console.log('before evaluation: ', c.stack)
const comp = await compile(c, s)

await evaluate(c, comp)
console.log('after evaluation: ', c.stack)

console.log('recompiling')
await run(c, ': foo 420 100 ; ')

await evaluate(c, comp)
console.log('evaluation after recompiling', c.stack)
