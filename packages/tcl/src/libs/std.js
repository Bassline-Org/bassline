import { RC } from '../tok.js'

export const std = {
  set: ([name, value], interp) => (value === undefined ? interp.get(name) : interp.set(name, value)),
  puts: ([msg]) => (console.log(msg), msg),
  if: ([cond, then, , elseBranch], interp) => interp.run(Number(interp.run(cond)) ? then : (elseBranch ?? '')),
  while: ([cond, body], interp) => {
    let result = ''
    while (Number(interp.run(cond))) {
      try {
        result = interp.run(body)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
    }
    return result
  },

  proc: ([name, params, body], interp) => {
    const paramList = params.split(/\s+/).filter(Boolean)
    interp.register(name, (args, caller) => {
      const local = caller.scope()
      paramList.forEach((p, i) => local.set(p, args[i]))
      try {
        return local.run(body)
      } catch (e) {
        if (e !== RC.RETURN) throw e
        return local.result
      }
    })
  },

  return: ([val], interp) => {
    interp.result = val ?? ''
    throw RC.RETURN
  },

  break: () => {
    throw RC.BREAK
  },

  continue: () => {
    throw RC.CONTINUE
  },
}
