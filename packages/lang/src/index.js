export { read, readAll, sym, isSym } from './reader.js'
export { evaluate } from './evaluator.js'
import { readAll } from './reader.js'
import { evaluate } from './evaluator.js'

export function run(source, env = {}) {
  const exprs = readAll(source)
  let result = null
  for (const expr of exprs) result = evaluate(expr, env)
  return result
}
