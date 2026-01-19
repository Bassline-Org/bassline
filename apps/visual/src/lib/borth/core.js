// constants
export const COMPILE = 'compile';
export const INTERP = 'interp';
export const WS = ' \t\n\r';
export const isWS = c => WS.includes(c)
export const _WORD = Symbol('$$BORTH_WORD');
export const castArr = (v) => {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return []
  return [v]
}
export const merge = (a, b) => {
  const both = (fn) => fn(a) === fn(b);
  if (both(Array.isArray)) {
    return [...a, ...b]
  }
  if (both(v => v instanceof Map)) {
    const result = new Map(a)
    for (const [k, v] of b) result.set(k, v)
    return result
  }
  if (both(v => Object.keys(v)?.length)) {
    return { ...a, ...b }
  }
  if (both(v => typeof v)) {
    return [a, b]
  }
  throw new Error(`Invalid merge: a: ${a} b: ${b}`)
}
export const get = (obj, key) => {
  if (obj instanceof Map) return obj.get(key)
  return obj[key]
}
export const set = (obj, key, value) => {
  if (obj instanceof Map) return obj.set(key, value)
  return obj[key] = value
}
export const del = (obj, key) => {
  if (obj instanceof Map) return obj.delete(key, value)
  delete obj[key]
}
// frame access
export const frame = ctx => ctx.frames[ctx.frames.length - 1]
export const stack = ctx => frame(ctx).stack
export const mode = ctx => frame(ctx).mode
export const pushFrame = (ctx, mode = COMPILE) => {
  ctx.frames.push({ stack: [], mode })
  return ctx
}
export const popFrame = ctx => ctx.frames.pop()
export const setMode = (ctx, m) => (frame(ctx).mode = m, ctx)
export const src = (ctx) => ctx.src
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
// parsing
export const nextWord = ctx => {
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  if (ctx.pos >= ctx.src.length) return undefined
  const start = ctx.pos
  while (ctx.pos < ctx.src.length && !isWS(ctx.src[ctx.pos])) ctx.pos++
  return ctx.src.slice(start, ctx.pos)
}
export const parseUntil = (ctx, suffix) => {
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  const start = ctx.pos
  while (ctx.pos < ctx.src.length) {
    const parsed = ctx.src.slice(start, ctx.pos + 1)
    if (parsed.endsWith(suffix)) {
      ctx.pos++
      return parsed.slice(0, -suffix.length)
    }
    ctx.pos++
  }
  return ctx.src.slice(start)
}
// word management
export const define = (ctx, name, fn, immediate = false) => {
  const word = { name, fn, immediate, [_WORD]: true }
  ctx.ns.set(name, word)
  ctx.last = word
  return ctx
}
export const tryFind = (ctx, name) => {
  if (ctx.ns.has(name)) return ctx.ns.get(name)
  return undefined
}
export const find = (ctx, name) => {
  if (ctx.ns.has(name)) return ctx.ns.get(name)
  const num = Number(name)
  if (!isNaN(num)) return num
  throw new Error(`unknown: ${name}`)
}
export const lift = fn => async ctx => {
  const args = popN(ctx, fn.length)
  const result = castArr(fn(...args));
  pushN(ctx, result.filter(v => v !== undefined))
  return ctx
}
export const def = (name, fn) => ctx => define(ctx, name, lift(fn))
export const defI = (name, fn) => ctx => define(ctx, name, lift(fn), true)
export const defR = (name, fn) => ctx => define(ctx, name, fn)
export const defRI = (name, fn) => ctx => define(ctx, name, fn, true)
export const expose = (name, obj) => ctx => define(ctx, name, lift(async () => [obj]))

export const exec = async (ctx, value) => {
  const val = castArr(value);
  for (const value of val) {
    if (value?.ref) {
      ctx = await exec(ctx, find(ctx, value.ref))
    } else if (value?.fn && value[_WORD]) {
      if (mode(ctx) === COMPILE && !value.immediate) {
        ctx = push(ctx, { ref: value.name })
      } else {
        ctx = await value.fn(ctx)
      }
    } else {
      ctx = push(ctx, value)
    }
  }
  return ctx
}
export const run = async (ctx, source) => {
  ctx.src = source
  ctx.pos = 0
  let name;
  while ((name = nextWord(ctx)) !== undefined) {
    const word = find(ctx, name);
    ctx = await (exec(ctx, word))
  }
  return ctx
}

// === Core Definitions ===
const core = [
  // Stack
  def('dup', a => [a, a]),
  def('drop', _ => undefined),
  def('swap', (a, b) => [b, a]),
  def('rot', (a, b, c) => [b, c, a]),
  def('over', (a, b) => [a, b, a]),

  // Arithmetic
  def('+', (a, b) => [a + b]),
  def('-', (a, b) => [a - b]),
  def('*', (a, b) => [a * b]),
  def('/', (a, b) => [a / b]),
  def('mod', (a, b) => [a % b]),

  // Comparison
  def('=', (a, b) => [a === b]),
  def('<', (a, b) => [a < b]),
  def('>', (a, b) => [a > b]),
  def('<=', (a, b) => [a <= b]),
  def('>=', (a, b) => [a >= b]),

  defI('true', () => true),
  defI('false', () => false),
  defI('nil', () => null),
  def('merge', (a, b) => [merge(a, b)]),
  def('<map>', () => new Map()),

  // JS Bridge
  def('.has', (obj, key) => [get(obj, key) ? true : false]),
  def('.get', (obj, key) => [get(obj, key)]),
  def('.set', (obj, key, val) => { set(obj, key, val) }),
  def('.delete', (obj, key) => { del(obj, key) }),
  def('.call', (obj, method, args) => [obj[method].call(obj, ...castArr(args))]),

  defR('/context', async c => {
    push(c, c)
    return c
  }),
  defR('/source', async c => {
    push(c, src(c))
    return c
  }),
  defR('/clear', async c => {
    const s = stack(c)
    s.splice(0, s.length)
    return c
  }),
  // Control - stack order: condition true-branch false-branch if
  defR('if', async c => {
    const [cond, t, f] = popN(c, 3)
    return exec(c, cond ? t : f)
  }),

  defR('do', async c => exec(c, pop(c))),

  defR('times', async c => {
    const [n, body] = popN(c, 2)
    for (let i = 0; i < n; i++) {
      push(c, i)
      c = await exec(c, body)
    }
    return c
  }),

  defR('each', async c => {
    const [body, arr] = popN(c, 2)
    for (const x of arr) {
      push(c, x)
      c = await exec(c, body)
    }
    return c
  }),

  // Definition - ':' parses name, pushes frame, pushes name onto new stack
  defRI(':', async c => {
    const name = nextWord(c)
    pushFrame(c, 'compile')
    push(c, name)
    return c
  }),

  // ';' pops frame, first item is name, rest is body
  defRI(';', async c => {
    const f = popFrame(c)
    const [name, ...body] = f.stack
    if (c.frames.length === 1) setMode(c, 'interp')
    return define(c, name, async x => exec(x, body))
  }),

  // Quotation
  defRI('[', async c => pushFrame(c)),
  defRI(']', async c => {
    const f = popFrame(c)
    if (c.frames.length === 1) setMode(c, 'interp')
    return push(c, f.stack)
  }),

  // Parsing
  defRI("'", async c => push(c, nextWord(c))),
  defRI('"', async c => push(c, parseUntil(c, '"'))),
  defR('parse', async c => push(c, parseUntil(c, pop(c)))),

  // Variable
  defRI('variable', async c => {
    const name = nextWord(c)
    const cell = { value: undefined }
    cell.read = () => cell.value
    cell.write = v => { cell.value = v }
    return define(c, name, async x => push(x, cell))
  }),
]

export const loadDefs = (context, defs) => castArr(defs).reduce((ctx, d) => d(ctx), context)

export const createRuntime = () => {
  const coreNs = new Map()
  const ctx = {
    src: '', pos: 0,
    frames: [{ stack: [], mode: 'interp' }],
    ns: coreNs,
    namespaces: new Map([['core', coreNs]]),
    last: null,
  }
  return loadDefs(ctx, core)
}