let _gensymCount = 0
const gensym = (name = 'GENERATED') => `'@@GENSYM'__${name}__${_gensymCount++}`

const WS = ' \t\n\r';
const isWS = c => WS.includes(c)
const arrayify = v =>
      Array.isArray(v)
      ? v
      : v === undefined
      ? []
      : [v]

const panic = (msg, label = 'panic') => {
  throw new Error(`${label}: ${msg}`)
}

const take = (arr, n) => arr.splice(arr.length - n, n)
const append = (arr, ...items) => arr.splice(arr.length, 0, ...items)
const last = (arr) => arr.at(-1);

const nextToken = ctx => {
  const lastPos = ctx.pos ?? 0
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  if (ctx.pos >= ctx.src.length) return undefined
  const start = ctx.pos
  while (ctx.pos < ctx.src.length && !isWS(ctx.src[ctx.pos])) ctx.pos++
  ctx.lastPos = lastPos
  return ctx.src.slice(start, ctx.pos)
}

const stage = (ctx, ...items) => (append(last(ctx.scope).staging, ...items), ctx)
const scope = (onExit) => ({staging: [], onExit})
const enter = (ctx, onExit) => (append(ctx.scope, scope(onExit)), ctx);
const exit = async (ctx) => {
  const s = ctx.scope.pop()
  const r = await s.onExit(ctx, s.staging)
  if (last(ctx.scope)) stage(ctx, ...arrayify(r))
  return r
}

const resolveNs = (ctx, name) => {
  if(ctx.vocabs[name]) return ctx.vocabs[name]
  ctx.vocabs[name] = {}
  return ctx.vocabs[name]
}
const find = (ctx, name) => {
  if(name in ctx.ns) return ctx.ns[name]
  for (const ns of ctx.search) {
    if(ns[name]) return ns[name]
  }
  const num = Number(name)
  if (!isNaN(num)) return constant(num)
  panic(`unknown: ${name}`)
}
const define = (ctx, word) => {
  if (!word.props.name) word.props.name = gensym()
  const name = word.props.name;
  const existing = ctx.ns[name];
  if(existing) {
    existing.impl = word.impl; existing.props = word.props;
    return existing
  }
  ctx.ns[name] = word
  return word
}

const word = (fn = () => panic("No implemented!"), props = {}) => ({
  props,
  impl: fn,
  async exec(ctx) {
    return this.impl(await ctx)
  }
})

const stackify = fn => arr => {
  const args = take(arr, fn.length)
  const r = fn(...args);
  append(arr, ...r)
}

const variable = (init) => {
  const w = word(
    (c) => (c.stack.push(w.props.slot), c),
    {type: 'variable', slot: init}
  )
  return w;
}
const prim = (name, fn) => word(
  (c) => (stackify(fn)(c.stack), c),
  {type: 'primitive', name}
)
const syn = (name, fn) => word(
  async (c) => await (fn(c) ?? c),
  {type: 'syntax', name, parsing: true}
)
const constant = (value) => word((c) => (append(c.stack, value), c), {type: 'constant', value})

const compile = async (ctx, src) => {
  const c = { ...ctx, src, pos: 0 }
  enter(c, (_, s) => s)
  let t
  while ((t = nextToken(c))) {
    const w = find(c, t)
    w.props.parsing ? await w.exec(c) : stage(c, w)
  }
  return await exit(c)
}
const evaluate = async (ctx, compiled) => {
  for (const w of compiled) ctx = await w.exec(await ctx)
}
const run = async (ctx, source) => (await evaluate(ctx, await compile(ctx, source)), ctx)

const docol = (name, words, p) => {
  const w = word(
    async c => (await evaluate(c, w.props.words), c),
    { type: 'compiled', name, words, ...p }
  );
  return w
}
const context = () => {
  const scratch = {}
  return {
    ns: scratch,
    search: [],
    vocabs: {scratch},
    search: [],
    stack: [],
    scope: []
  }
}

const c = context()

const src = `
  : foo 10 20 + ;

  foo
`

const lib = [
  prim('+', (a, b) => [a + b]),
  prim('-', (a, b) => [a - b]),
  prim('*', (a, b) => [a * b]),
  prim('/', (a, b) => [a / b]),
  syn(':', (c) => {
    const name = nextToken(c);
    enter(c, (c, staging) => {define(c, docol(name, staging))})
    return c
  }),
  syn(';', async (c) => {
    await exit(c)
    return c;
  })
]
for(const w of lib) define(c, w);

const compiled = await compile(c, src)
console.log(compiled)
await evaluate(c, compiled)
console.log(c.stack)
