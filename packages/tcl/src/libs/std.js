import { RC } from '../tok.js'
import { TclError } from '../error.js'
import { parseList } from './list.js'
import { expr } from '../expr.js'

// Helper to evaluate expression with error wrapping
function safeExpr(cond, rt) {
  try {
    return Number(expr(cond, rt))
  } catch (err) {
    throw TclError.from(err, { script: cond, command: 'expr' })
  }
}

export const std = {
  set: ([name, value], rt) => (value === undefined ? rt.getVar(name) : rt.setVar(name, value)),
  puts: ([msg]) => (console.log(msg), msg),

  // Infix expression evaluator (Tcl-compatible)
  expr: (args, rt) => expr(args.join(' '), rt),

  // Conditions are evaluated as expressions
  if: ([cond, then, , elseBranch], rt) => rt.run(safeExpr(cond, rt) ? then : (elseBranch ?? '')),

  while: ([cond, body], rt) => {
    let result = ''
    while (safeExpr(cond, rt)) {
      try {
        result = rt.run(body)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
    }
    return result
  },

  proc: ([name, params, body], rt) => {
    const paramList = parseList(params)
    const fn = (args, caller) => {
      // Create a child namespace for local scope
      const savedCurrent = caller.current
      const localNs = caller.current.child(`_proc_${Date.now()}`)

      // Push call frame for upvar/uplevel
      caller.pushFrame(savedCurrent)
      caller.current = localNs

      paramList.forEach((p, i) => caller.setVar(p, args[i] ?? ''))
      try {
        return caller.run(body)
      } catch (e) {
        if (e !== RC.RETURN) throw e
        return caller.result
      } finally {
        caller.current = savedCurrent
        caller.popFrame()
      }
    }
    // Attach metadata for introspection
    fn._isProc = true
    fn._params = paramList
    fn._body = body
    rt.register(name, fn)
  },

  return: ([val], rt) => {
    rt.result = val ?? ''
    throw RC.RETURN
  },

  break: () => {
    throw RC.BREAK
  },

  continue: () => {
    throw RC.CONTINUE
  },

  // for {init} {cond} {next} body - cond is an expression
  for: ([init, cond, next, body], rt) => {
    rt.run(init)
    let result = ''
    while (safeExpr(cond, rt)) {
      try {
        result = rt.run(body)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
      rt.run(next)
    }
    return result
  },

  // foreach varName list body
  // foreach {v1 v2} list body - multiple vars
  foreach: (args, rt) => {
    const body = args[args.length - 1]
    let result = ''

    // Collect var/list pairs (can have multiple)
    const pairs = []
    for (let i = 0; i < args.length - 1; i += 2) {
      const vars = parseList(args[i])
      const list = parseList(args[i + 1])
      pairs.push({ vars, list })
    }

    // Find the longest list
    const maxLen = Math.max(...pairs.map(p => Math.ceil(p.list.length / p.vars.length)))

    for (let i = 0; i < maxLen; i++) {
      // Set variables for this iteration
      for (const { vars, list } of pairs) {
        for (let v = 0; v < vars.length; v++) {
          const idx = i * vars.length + v
          rt.setVar(vars[v], list[idx] ?? '')
        }
      }

      try {
        result = rt.run(body)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
    }
    return result
  },

  // switch ?options? string { pattern body ... }
  // switch ?options? string pattern body ?pattern body ...?
  switch: (args, rt) => {
    let opts = { mode: 'exact' }
    let i = 0

    // Parse options
    while (i < args.length && args[i].startsWith('-')) {
      const opt = args[i]
      if (opt === '-exact') opts.mode = 'exact'
      else if (opt === '-glob') opts.mode = 'glob'
      else if (opt === '-regexp') opts.mode = 'regexp'
      else if (opt === '--') {
        i++
        break
      }
      i++
    }

    const str = args[i++]
    let patterns

    // Check if patterns are in a single braced body or as separate args
    if (args.length - i === 1) {
      // Single body with pattern/body pairs
      patterns = parseList(args[i])
    } else {
      // Separate pattern body args
      patterns = args.slice(i)
    }

    // Process pattern/body pairs
    for (let j = 0; j < patterns.length; j += 2) {
      const pattern = patterns[j]
      const body = patterns[j + 1]

      // Check for default
      if (pattern === 'default') {
        return rt.run(body)
      }

      let match = false
      if (opts.mode === 'exact') {
        match = str === pattern
      } else if (opts.mode === 'glob') {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        match = regex.test(str)
      } else if (opts.mode === 'regexp') {
        match = new RegExp(pattern).test(str)
      }

      if (match) {
        // Handle fall-through with '-'
        if (body === '-') continue
        return rt.run(body)
      }
    }
    return ''
  },

  // incr varName ?increment?
  incr: ([varName, increment = '1'], rt) => {
    let value
    try {
      value = parseInt(rt.getVar(varName))
    } catch {
      value = 0
    }
    const result = String(value + parseInt(increment))
    rt.setVar(varName, result)
    return result
  },

  // catch script ?resultVar? ?optionsVar?
  catch: (args, rt) => {
    const [script, resultVar, optionsVar] = args
    try {
      const result = rt.run(script)
      if (resultVar) rt.setVar(resultVar, result)
      if (optionsVar) rt.setVar(optionsVar, '')
      return '0'
    } catch (e) {
      if (e === RC.RETURN || e === RC.BREAK || e === RC.CONTINUE) {
        throw e // Re-throw control flow exceptions
      }
      if (resultVar) rt.setVar(resultVar, e.message || String(e))
      if (optionsVar) rt.setVar(optionsVar, 'error')
      return '1'
    }
  },

  // error message ?info? ?code?
  error: ([message, info, code]) => {
    const err = new TclError(message)
    err.info = info
    err.code = code
    throw err
  },

  // eval script
  eval: ([script], rt) => rt.run(script),

  // source - placeholder (would load from file)
  source: ([filename], rt) => {
    throw new Error(`source: file loading not implemented (${filename})`)
  },
}
