/**
 * Combinators
 *
 * Higher-order functions for composing functions:
 * - Unary: pipe, sequence
 * - Binary: hook, both, flip
 * - Ternary: fork
 * - Variadic: converge
 * - Special: K, duplicate
 */

// Unary combinators

// pipe: left-to-right composition  pipe(f,g)(x) = g(f(x))
export const pipe = (ctx, ...compiledArgs) => {
  const { get } = ctx
  // If called from compileDefinition, compiledArgs are pre-compiled fns
  // If called from config, ctx.steps contains fn names
  const fns =
    compiledArgs.length > 0
      ? compiledArgs
      : (ctx.steps || []).map((step) =>
          typeof step === 'string'
            ? get(step, {})
            : get(step.fn || step[0], step.config || step[1] || {})
        )
  return (x) => fns.reduce((val, fn) => fn(val), x)
}

// sequence: Run fns in sequence, return last result (like progn)
// Each fn gets the original input, not the previous output
export const sequence = (ctx, ...compiledArgs) => {
  const { get } = ctx
  const fns =
    compiledArgs.length > 0
      ? compiledArgs
      : (ctx.steps || []).map((step) =>
          typeof step === 'string'
            ? get(step, {})
            : get(step.fn || step[0], step.config || step[1] || {})
        )
  return (x) => {
    let result = x
    for (const fn of fns) result = fn(x) // Each gets original x
    return result
  }
}

// Binary combinators

// hook: APL hook  hook(f,g)(x) = f(x, g(x))
export const hook = (ctx, binary, transform) => {
  const { get } = ctx
  // Validate argument count when using compiled args
  if (binary !== undefined && transform === undefined) {
    throw new Error('hook requires exactly 2 handlers: binary, transform')
  }
  const binaryFn = binary || get(ctx.binary, {})
  const transformFn = transform || get(ctx.transform, {})
  return (x) => binaryFn(x, transformFn(x))
}

// both: Run two handlers and return pair  both(f,g)(x) = [f(x), g(x)]
export const both = (ctx, left, right) => {
  const { get } = ctx
  // Validate argument count when using compiled args
  if (left !== undefined && right === undefined) {
    throw new Error('both requires exactly 2 handlers: left, right')
  }
  const leftFn = left || get(ctx.left, {})
  const rightFn = right || get(ctx.right, {})
  return (x) => [leftFn(x), rightFn(x)]
}

// flip: Swap arguments  flip(f)(x,y) = f(y,x)
export const flip = (ctx, compiledFn) => {
  const { get } = ctx
  const innerFn = compiledFn || get(ctx.fn, ctx.fnConfig || {})
  return (x, y) => innerFn(y, x)
}

// Ternary combinators

// fork: APL fork  fork(f,g,h)(x) = g(f(x), h(x))
// Left and right branches produce values, middle combines them
export const fork = (ctx, left, middle, right) => {
  const { get } = ctx
  // Validate argument count when using compiled args
  if (left !== undefined && (middle === undefined || right === undefined)) {
    throw new Error('fork requires exactly 3 handlers: left, middle, right')
  }
  const leftFn = left || get(ctx.left, {})
  const middleFn = middle || get(ctx.middle, {})
  const rightFn = right || get(ctx.right, {})
  return (x) => middleFn(leftFn(x), rightFn(x))
}

// Variadic combinators

// converge: Multiple branches combined  converge(f, [g,h])(x) = f(g(x), h(x))
export const converge = (ctx, combiner, ...branches) => {
  const { get } = ctx
  const combinerFn = combiner || get(ctx.combiner?.fn || ctx.combiner, ctx.combiner?.config || {})
  const branchFns =
    branches.length > 0
      ? branches
      : (ctx.branches || []).map((b) =>
          typeof b === 'string' ? get(b, {}) : get(b.fn, b.config || {})
        )
  return (x) => combinerFn(...branchFns.map((fn) => fn(x)))
}

// Special combinators

// K (constant combinator): Always return a fixed value  K(c)(x) = c
// This is distinct from 'constant' which takes config.value
export const K = (ctx) => () => ctx.value

// duplicate: Apply argument twice  W(f)(x) = f(x,x)
// Also known as the W combinator
export const duplicate = (ctx, compiledFn) => {
  const { get } = ctx
  const innerFn = compiledFn || get(ctx.fn, ctx.fnConfig || {})
  return (x) => innerFn(x, x)
}
