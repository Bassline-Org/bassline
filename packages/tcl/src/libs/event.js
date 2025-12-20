// Event system - traces, timers, and event loop integration
// Maps to JavaScript's event loop (setTimeout, queueMicrotask, Promises)

import { parseList, formatList } from './list.js'

export const event = {
  // trace add variable name ops script
  // trace remove variable name ops script
  // trace info variable name
  trace: (args, rt) => {
    const [subcmd, type, ...rest] = args

    if (type !== 'variable') {
      throw new Error(`trace: unsupported type "${type}"`)
    }

    switch (subcmd) {
      case 'add': {
        const [varName, opsStr, script] = rest
        const ops = parseList(opsStr)
        const callback = (name, op, oldVal, newVal) => {
          // Set trace variables before running script
          rt.setVar('_trace_name', name)
          rt.setVar('_trace_op', op)
          rt.setVar('_trace_old', oldVal ?? '')
          rt.setVar('_trace_new', newVal ?? '')
          rt.run(script)
        }
        // Store script reference for removal
        callback._script = script
        callback._ops = ops
        rt.addTrace(varName, ops, callback)
        return ''
      }

      case 'remove': {
        const [varName, opsStr, script] = rest
        const ops = parseList(opsStr)
        const traces = rt.getTraces(varName)
        const trace = traces.find(
          t =>
            t.callback._script === script &&
            t.callback._ops.length === ops.length &&
            t.callback._ops.every((o, i) => o === ops[i])
        )
        if (trace) {
          rt.removeTrace(varName, ops, trace.callback)
        }
        return ''
      }

      case 'info': {
        const [varName] = rest
        const traces = rt.getTraces(varName)
        return formatList(traces.map(t => formatList([formatList(t.callback._ops), t.callback._script])))
      }

      default:
        throw new Error(`trace: unknown subcommand "${subcmd}"`)
    }
  },

  // after ms ?script?
  // after cancel id
  // after idle script
  // after info ?id?
  after: (args, rt) => {
    const first = args[0]

    // after cancel id
    if (first === 'cancel') {
      const id = args[1]
      const event = rt.afterEvents.get(id)
      if (event) {
        clearTimeout(event.timeout)
        rt.afterEvents.delete(id)
      }
      return ''
    }

    // after info ?id?
    if (first === 'info') {
      if (args[1]) {
        const event = rt.afterEvents.get(args[1])
        if (!event) return ''
        return formatList([event.script, event.type])
      }
      return formatList([...rt.afterEvents.keys()])
    }

    // after idle script
    if (first === 'idle') {
      const script = args.slice(1).join(' ')
      const id = `after#${++rt.afterId}`
      rt.afterEvents.set(id, {
        script,
        type: 'idle',
        timeout: null,
      })
      // Use queueMicrotask for idle callbacks
      queueMicrotask(() => {
        if (rt.afterEvents.has(id)) {
          rt.afterEvents.delete(id)
          rt.run(script)
        }
      })
      return id
    }

    // after ms ?script?
    const ms = parseInt(first)
    if (isNaN(ms)) {
      throw new Error(`after: expected integer but got "${first}"`)
    }

    if (args.length === 1) {
      // Blocking sleep - return a Promise
      return new Promise(resolve => setTimeout(resolve, ms))
    }

    // Schedule script execution
    const script = args.slice(1).join(' ')
    const id = `after#${++rt.afterId}`
    const timeout = setTimeout(() => {
      rt.afterEvents.delete(id)
      rt.run(script)
    }, ms)

    rt.afterEvents.set(id, { script, type: 'timer', timeout })
    return id
  },

  // vwait varName - wait until variable is modified
  // Returns a Promise that resolves when the variable changes
  vwait: ([varName], rt) => {
    return new Promise(resolve => {
      const callback = (name, op, oldVal, newVal) => {
        rt.removeTrace(varName, ['write'], callback)
        resolve(newVal)
      }
      rt.addTrace(varName, ['write'], callback)
    })
  },

  // update ?idletasks? - process pending events
  // In JS, this yields to the event loop
  update: args => {
    const idletasks = args[0] === 'idletasks'
    if (idletasks) {
      // Just process microtasks
      return new Promise(resolve => queueMicrotask(resolve))
    }
    // Process all pending events (one tick of event loop)
    return new Promise(resolve => setTimeout(resolve, 0))
  },

  // unset varName ?varName ...? - unset variables
  unset: (args, rt) => {
    for (const name of args) {
      rt.unsetVar(name)
    }
    return ''
  },
}
