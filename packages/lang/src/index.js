export { read, readAll, isSym } from './reader.js'
export { evaluate, special, specialForms, mkVar, isVar } from './evaluator.js'
export { defaultEnv } from './env.js'
import { readAll } from './reader.js'
import { createEnv, evaluate } from './evaluator.js'
import { defaultEnv } from './env.js'

export function run(source, env = createEnv(defaultEnv)) {
  const exprs = readAll(source)
  let result = null
  for (const expr of exprs) result = evaluate(expr, env)
  return result
}
