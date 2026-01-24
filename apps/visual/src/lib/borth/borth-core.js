let _gensymCount = 0
export const gensym = (name = 'GENERATED') => `'@@GENSYM'__${name}__${_gensymCount++}`

export const WS = ' \t\n\r';
export const isWS = c => WS.includes(c)

export const panic = (msg, label = 'panic') => {
  throw new Error(`${label}: ${msg}`)
}
export const assert = (cond, msg) => cond || panic(`Assertion failed! ${msg}`, 'assert')

export const nary = (...fns) => {
  const impls = fns.reduce((acc, f) => ({...acc, [f.length]: f}), {});
  return (...args) => {
    const impl = impls[args.length]
    if(!impl) panic(`no implemented for ${args.length} arguments!`)
    return impl(...args)
  }
}

export const castArr = v => {
  if (Array.isArray(v)) return v
  if (v === undefined || v === null) return []
  return [v]
}

const take = (arr, n) => arr.splice(arr.length - n, n)
const append (arr, items) => arr.splice(arr.length, 0, ...items)

export const nextToken = ctx => {
  const lastPos = ctx.pos ?? 0
  while (ctx.pos < ctx.src.length && isWS(ctx.src[ctx.pos])) ctx.pos++
  if (ctx.pos >= ctx.src.length) return undefined
  const start = ctx.pos
  while (ctx.pos < ctx.src.length && !isWS(ctx.src[ctx.pos])) ctx.pos++
  ctx.lastPos = lastPos
  return ctx.src.slice(start, ctx.pos)
}
export const nextTokens = (ctx, n) => {
  const out = []
  for (let i = 0; i < n; i++) out.push(nextToken(ctx))
  return out
}
export const parseUntil = (ctx, stopToken) => {
  // skip the trailing space of the start token
  const start = ctx.pos + 1
  let next
  while ((next = nextToken(ctx))) {
    if (next === stopToken) {
      // stop 1 char earlier because of trailing space for tokens
      const stop = ctx.pos - stopToken.length - 1
      return ctx.src.slice(start, stop)
    }
  }
  panic(`unmatched delimiter starting beginning at pos: ${start} expected: ${stopToken}`)
}

export const currentScope = (ctx) => ctx.scope.at(-1);
export const stage = (ctx, ...items) => {
  const current = currentScope(ctx);
  current.staging.push(...items)
  return ctx
}
export const enterCompilationScope = (ctx, onExit) => {
  const scope = {
    staging: [],
    onExit,
  }
  ctx.scope.push(scope)
  return ctx
}
export const exitCompilationScope = async (ctx) => {
  const {onExit, ...scope} = ctx.scope.pop()
  scope.stopPos = ctx.pos;
  const definition = ctx.src.slice(scope.startPos, scope.stopPos);
  await ctx.emit({definition});
  assert(scope, `failed to exit compilation scope`)
  const current = currentScope(ctx);
  const toStage = castArr(await onExit(ctx, scope))
  if(current) {
    await stage(ctx, ...toStage)
  }
  return toStage
}

export const find = (ctx, name) => {
  if (ctx.ns.has(name)) return ctx.ns.get(name)
  for (const ns of ctx.search) {
    if(ns.has(name)) return ns.get(name)
  }
  const num = Number(name)
  if (!isNaN(num)) return constant(num)
  panic(`unknown: ${name}`)
}
export const define = (ctx, word) => {
  if (!word.props.name) {
    word.props.name = gensym()
  }
  if(ctx.ns.has(name)) {
    const w = ctx.ns.get(name);
    w.impl = word.impl;
    w.props = word.props
    return w
  } else {
    ctx.ns.set(name, word)
    return word
  }
}

export const word = (fn, props = {}) => ({
  props,
  impl: fn ?? () => panic("No implemented!"),
  async exec() {
    return this.impl(await ctx)
  }
})

export const stackify = fn => async ctx => {
  const args = await pop(ctx, fn.length)
  const result = castArr(await fn(...args)).filter(v => v !== undefined)
  return push(ctx, ...result)
}

export const variable = (initial, extraProps) => word(
    stackify(() => [props(this).slot]),
    { type: 'variable', slot: initial, ...extraProps }
  )
export const def = (fn, extraProps) => word(stackify(fn), { type: 'primitive', ...extraProps })
export const syn = (fn, extraProps) => word(fn, { type: 'syntax', parsing: true, ...extraProps })
export const constant = (value, e) => def(() => [value], {type: 'constant', value, ...e})

export const compile = async (ctx, source) => {
  let compCtx = { ...ctx, src: source, lastPos: 0, pos: 0, stack: undefined }
  enterCompilationScope(compCtx, (ctx, {staging}) => staging);
  let name;
  while ((name = nextToken(compCtx)) !== undefined) {
    const word = find(compCtx, name)
    const { parsing } = props(word)
    if (parsing) {
      compCtx = await word.exec(compCtx)
    } else {
      await stage(compCtx, word);
    }
  }
  return exitCompilationScope(compCtx);
}

export const evaluate = async (ctx, compiled) => {
  for (const w of compiled) {
    ctx = await w.exec(await ctx)
  }
}

export const run = async(ctx, source) => {
  const compiled = await compile(ctx, source);
  await evaluate(ctx, compiled);
  return ctx
}

export const docol = (name, words, additionalProps) => {
  const w = word(
    //async c => (await evaluate(c, props(w).words), c),
    async c => (await evaluate(c, words), c),
    { type: 'compiled', name, words, ...additionalProps }
  );
  return w
}
export const freshContext = () => {
  const scratch = new Map();
  const ctx = {
    ns: scratch,
    emit: console.log,
    vocabs: {scratch},
    search: [],
    stack: [],
    scope: []
  }
  return ctx
}
