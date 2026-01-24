let _gensymCount = 0
export const gensym = (name = 'GENERATED') => `'@@GENSYM'__${name}__${_gensymCount++}`
const panic = msg => {
  throw new Error(`panic: ${msg}`)
}
const todo = name => panic(`${name} not implemented`)
const assert = (cond, msg) => {
  if (!cond) {
    panic(`Assertion failed! Message: ${msg}`)
  }
}

// constants
export const WS = ' \t\n\r'
export const isWS = c => WS.includes(c)

export const castArr = v => {
  if (Array.isArray(v)) return v
  if (v === undefined || v === null) return []
  return [v]
}

// context access
export const stack = ctx => ctx.stack
export const ns = ctx => ctx.ns
export const compUnit = ctx => {
  const unit = ctx.compUnits[ctx.compUnits.length - 1]
  assert(unit, 'compUnit missing compilation unit!')
  return unit
}
export const pushCompUnit = (ctx, fn) => {
  todo('pushCompUnit')
  ctx.compUnits.push({ quote: [], properties: {}, fn })
  return ctx
}
export const popCompUnit = ctx => {
  todo('popCompUnit')
  assert(unit, 'compUnit missing compilation unit!')
}
export const src = ctx => ctx.src
// stack management
export const pop = ctx => stack(ctx).pop()
export const push = (ctx, v) => (stack(ctx).push(v), ctx)
export const popN = (ctx, n) => {
  const items = []
  for (let i = 0; i < n; i++) items.unshift(pop(ctx))
  return items
}
export const pushN = (ctx, items) => {
  for (const v of castArr(items)) if (v !== undefined) push(ctx, v)
  return ctx
}

export const nextWord = ctx => {
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  if (ctx.pos >= ctx.src.length) return undefined
  const start = ctx.pos
  while (ctx.pos < ctx.src.length && !isWS(ctx.src[ctx.pos])) ctx.pos++
  return ctx.src.slice(start, ctx.pos)
}

// words
export const parsing = word => word?.properties?.parsing
export const define =
  (fn, properties = {}) =>
  ctx => {
    const unit = compUnit(ctx)
    const { name, ...rest } = properties
    const word = {
      fn,
      unit,
      properties: { ...rest, name: name ?? gensym() },
    }
    unit.push(word)
    return ctx
  }

export const find = (ctx, name) => {
  if (ctx.ns.has(name)) return ctx.ns.get(name)
  const num = Number(name)
  if (!isNaN(num)) return num
  throw new Error(`unknown: ${name}`)
}
export const stackify = fn => async ctx => {
  const args = popN(ctx, fn.length)
  const result = castArr(await fn(...args))
  pushN(
    ctx,
    result.filter(v => v !== undefined)
  )
  return ctx
}

const word = fn => {
  const wrapped = async ctx => fn(await ctx)
  wrapped.fn = fn
  wrapped.properties = {}
  return wrapped
}

export const def = (name, fn) => ctx => {
  //{ type: 'primitive-lifted', parsing: false }
}
export const syntax = (name, fn) => ctx => define(ctx, name, { name, parsing: true })
export const defI = (name, fn) => ctx => define(ctx, name, lift(fn), true)
export const defR = (name, fn) => ctx => define(ctx, name, fn)
export const defRI = (name, fn) => ctx => define(ctx, name, fn, true)
export const expose = (name, obj) => ctx =>
  define(
    ctx,
    name,
    lift(async () => [await obj])
  )

export const compile = async (ctx, source) => {
  ctx.src = source
  ctx.pos = 0
  pushCompUnit(ctx)
  let name
  while ((name = nextWord(ctx)) !== undefined) {
    const word = find(ctx, name)
    if (parsing(word)) {
    }
    ctx = await exec(ctx, word)
  }
  return ctx
}

export const run = async (ctx, source) => {
  ctx.src = source
  ctx.pos = 0
  let name
  while ((name = nextWord(ctx)) !== undefined) {
    const word = find(ctx, name)
    ctx = await exec(ctx, word)
  }
  return ctx
}

// // === Core Definitions ===
// const core = [
//   // Stack
//   def('dup', a => [a, a]),
//   def('drop', _ => undefined),
//   def('swap', (a, b) => [b, a]),
//   def('rot', (a, b, c) => [b, c, a]),
//   def('over', (a, b) => [a, b, a]),

//   // Arithmetic
//   def('+', (a, b) => [a + b]),
//   def('-', (a, b) => [a - b]),
//   def('*', (a, b) => [a * b]),
//   def('/', (a, b) => [a / b]),
//   def('mod', (a, b) => [a % b]),

//   // Comparison
//   def('=', (a, b) => [a === b]),
//   def('<', (a, b) => [a < b]),
//   def('>', (a, b) => [a > b]),
//   def('<=', (a, b) => [a <= b]),
//   def('>=', (a, b) => [a >= b]),

//   defI('true', () => true),
//   defI('false', () => false),
//   defI('nil', () => null),
//   def('merge', (a, b) => [merge(a, b)]),
//   def('<map>', () => new Map()),

//   // JS Bridge
//   def('.has', (obj, key) => [get(obj, key) ? true : false]),
//   def('.get', (obj, key) => [get(obj, key)]),
//   def('.set', (obj, key, val) => { set(obj, key, val) }),
//   def('.delete', (obj, key) => { del(obj, key) }),
//   def('.call', (obj, method, args) => [obj[method].call(obj, ...castArr(args))]),

//   defR('/context', async c => {
//     push(c, c)
//     return c
//   }),
//   defR('/source', async c => {
//     push(c, src(c))
//     return c
//   }),
//   defR('/clear', async c => {
//     const s = stack(c)
//     s.splice(0, s.length)
//     return c
//   }),
//   // Control - stack order: condition true-branch false-branch if
//   defR('if', async c => {
//     const [cond, t, f] = popN(c, 3)
//     return exec(c, cond ? t : f)
//   }),
//   defR('do', async c => exec(c, pop(c))),
//   defR('times', async c => {
//     const [n, body] = popN(c, 2)
//     for (let i = 0; i < n; i++) {
//       push(c, i)
//       c = await exec(c, body)
//     }
//     return c
//   }),

//   defR('each', async c => {
//     const [body, arr] = popN(c, 2)
//     for (const x of arr) {
//       push(c, x)
//       c = await exec(c, body)
//     }
//     return c
//   }),

//   // Definition - ':' parses name, pushes frame, pushes name onto new stack
//   defRI(':', async c => {
//     const name = nextWord(c)
//     pushFrame(c, 'compile')
//     push(c, name)
//     return c
//   }),

//   // ';' pops frame, first item is name, rest is body
//   defRI(';', async c => {
//     const f = popFrame(c)
//     const [name, ...body] = f.stack
//     if (c.frames.length === 1) setMode(c, 'interp')
//     return define(c, name, async x => exec(x, body))
//   }),

//   // Quotation
//   defRI('[', async c => pushFrame(c)),
//   defRI(']', async c => {
//     const f = popFrame(c)
//     if (c.frames.length === 1) setMode(c, 'interp')
//     return push(c, f.stack)
//   }),
//   defR('map', async c => {
//     const [arr, quote] = popN(c, 2);
//     const out = []
//     for (const item of castArr(arr)) {
//       c = await exec(c, [item, ...quote]);
//       out.push(pop(c))
//     }
//     return push(c, out)
//   }),
//   defR('filter', async c => {
//     const [arr, quote] = popN(c, 2);
//     const out = []
//     for (const item of castArr(arr)) {
//       c = await exec(c, [item, ...quote]);
//       if (pop(c)) {
//         out.push(item)
//       }
//     }
//     return push(c, out)
//   }),
//   defR('fold', async c => {
//     const [arr, quote, init] = popN(c, 3);
//     let acc = init;
//     for (const item of castArr(arr)) {
//       c = await exec(c, [acc, item, ...quote]);
//       acc = pop(c);
//     }
//     return push(c, acc)
//   }),
//   defR('take-n', async c => {
//     const n = pop(c);
//     const arr = popN(c, n);
//     push(c, arr)
//     return c;
//   }),
//   def('splice', async arr => castArr(arr)),

//   // Parsing
//   defRI("'", async c => push(c, nextWord(c))),
//   defRI('"', async c => push(c, parseUntil(c, '"'))),
//   defR('parse-word', async c => push(c, nextWord(c))),
//   defR('parse', async c => push(c, parseUntil(c, pop(c)))),

//   // Variable
//   defRI('variable', async c => {
//     const name = nextWord(c)
//     const cell = { value: undefined }
//     cell.read = () => cell.value
//     cell.write = v => { cell.value = v }
//     return define(c, name, async x => push(x, cell))
//   }),
// ]

// export const loadDefs = (context, defs) => castArr(defs).reduce((ctx, d) => d(ctx), context)

// export const createRuntime = () => {
//   const coreNs = new Map()
//   const ctx = {
//     src: '', pos: 0,
//     frames: [{ stack: [], mode: 'interp' }],
//     ns: coreNs,
//     namespaces: new Map([['core', coreNs]]),
//     last: null,
//   }
//   return loadDefs(ctx, core)
// }
