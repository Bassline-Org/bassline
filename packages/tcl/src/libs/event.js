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
        const callback = async (name, op, oldVal, newVal) => {
          // Set trace variables before running script
          rt.setVar('_trace_name', name)
          rt.setVar('_trace_op', op)
          rt.setVar('_trace_old', oldVal ?? '')
          rt.setVar('_trace_new', newVal ?? '')
          try {
            await rt.run(script)
          } catch {
            // Fire-and-forget: errors in trace scripts are silently ignored
          }
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
      // Queue for processing by vwait/update (cooperative scheduling)
      if (!rt.idleQueue) rt.idleQueue = []
      rt.idleQueue.push({ id, script })
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
    const timeout = setTimeout(async () => {
      rt.afterEvents.delete(id)
      try {
        await rt.run(script)
      } catch {
        // Fire-and-forget: errors in after scripts are silently ignored
      }
    }, ms)

    rt.afterEvents.set(id, { script, type: 'timer', timeout })
    return id
  },

  // vwait varName - wait until variable is modified (or already exists)
  // Processes idle queue sequentially, then waits for variable if needed
  vwait: async ([varName], rt) => {
    // Process idle queue sequentially (cooperative scheduling)
    if (rt.idleQueue) {
      while (rt.idleQueue.length > 0) {
        const { id, script } = rt.idleQueue.shift()
        if (rt.afterEvents.has(id)) {
          rt.afterEvents.delete(id)
          try {
            await rt.run(script)
          } catch {
            // Errors in idle scripts are silently ignored
          }
        }
      }
    }

    // Check if variable already exists - resolve immediately
    try {
      const value = rt.getVar(varName)
      return value
    } catch {
      // Variable doesn't exist, wait for it
    }

    return new Promise(resolve => {
      const callback = (name, op, oldVal, newVal) => {
        rt.removeTrace(varName, ['write'], callback)
        resolve(newVal)
      }
      rt.addTrace(varName, ['write'], callback)
    })
  },

  // update ?idletasks? - process pending events
  // Processes idle queue sequentially
  update: async (args, rt) => {
    // Process idle queue sequentially
    if (rt.idleQueue) {
      while (rt.idleQueue.length > 0) {
        const { id, script } = rt.idleQueue.shift()
        if (rt.afterEvents.has(id)) {
          rt.afterEvents.delete(id)
          try {
            await rt.run(script)
          } catch {
            // Errors in idle scripts are silently ignored
          }
        }
      }
    }
    return ''
  },

  // unset varName ?varName ...? - unset variables
  unset: (args, rt) => {
    for (const name of args) {
      rt.unsetVar(name)
    }
    return ''
  },
}
