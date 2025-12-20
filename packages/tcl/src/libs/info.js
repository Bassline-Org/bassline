// Info commands - introspection and reflection

import { formatList } from './list.js'

// Simple glob pattern matching
function globMatch(pattern, str) {
  if (!pattern) return true
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return regex.test(str)
}

export const info = {
  // info subcommand ?args...?
  info: (args, rt) => {
    const [subcmd, ...rest] = args

    const subcommands = {
      // info exists varName - check if variable exists
      exists: () => {
        const [varName] = rest
        try {
          rt.getVar(varName)
          return '1'
        } catch {
          return '0'
        }
      },

      // info vars ?pattern? - list variables in current namespace
      vars: () => {
        const [pattern] = rest
        const vars = [...rt.current.variables.keys()]
        const filtered = pattern ? vars.filter(v => globMatch(pattern, v)) : vars
        return formatList(filtered)
      },

      // info globals ?pattern? - list global variables
      globals: () => {
        const [pattern] = rest
        const vars = [...rt.root.variables.keys()]
        const filtered = pattern ? vars.filter(v => globMatch(pattern, v)) : vars
        return formatList(filtered)
      },

      // info locals ?pattern? - list local variables (same as vars for now)
      locals: () => {
        const [pattern] = rest
        const vars = [...rt.current.variables.keys()]
        const filtered = pattern ? vars.filter(v => globMatch(pattern, v)) : vars
        return formatList(filtered)
      },

      // info commands ?pattern? - list commands in current namespace
      commands: () => {
        const [pattern] = rest
        // Collect commands from current namespace and parents
        const cmds = new Set()
        let ns = rt.current
        while (ns) {
          for (const name of ns.commands.keys()) {
            cmds.add(name)
          }
          ns = ns.parent
        }
        const filtered = pattern ? [...cmds].filter(c => globMatch(pattern, c)) : [...cmds]
        return formatList(filtered.sort())
      },

      // info procs ?pattern? - list procedures (user-defined commands)
      procs: () => {
        const [pattern] = rest
        const procs = []
        for (const [name, fn] of rt.current.commands) {
          // Check if it's a proc (has _isProc marker or _params)
          if (fn._isProc || fn._params) {
            if (!pattern || globMatch(pattern, name)) {
              procs.push(name)
            }
          }
        }
        return formatList(procs.sort())
      },

      // info body procName - get procedure body
      body: () => {
        const [procName] = rest
        const cmd = rt.getCmd(procName)
        if (!cmd._body) {
          throw new Error(`"${procName}" isn't a procedure`)
        }
        return cmd._body
      },

      // info args procName - get procedure arguments
      args: () => {
        const [procName] = rest
        const cmd = rt.getCmd(procName)
        if (!cmd._params) {
          throw new Error(`"${procName}" isn't a procedure`)
        }
        return formatList(cmd._params)
      },

      // info default procName arg varName - get default value for argument
      default: () => {
        const [procName, argName, varName] = rest
        const cmd = rt.getCmd(procName)
        if (!cmd._defaults) {
          throw new Error(`"${procName}" isn't a procedure`)
        }
        if (argName in cmd._defaults) {
          rt.setVar(varName, cmd._defaults[argName])
          return '1'
        }
        return '0'
      },

      // info level ?n? - get call level or info about a level
      level: () => {
        if (rest.length === 0) {
          return String(rt.callStack.length)
        }
        const n = parseInt(rest[0])
        if (n === 0) {
          return 'info level 0' // Current level info
        }
        const frame = rt.getFrame(n)
        if (!frame) {
          throw new Error(`bad level "${n}"`)
        }
        return frame.ns.path()
      },

      // info frame ?n? - get call frame info
      frame: () => {
        const n = rest.length > 0 ? parseInt(rest[0]) : rt.callStack.length
        if (n === 0) {
          return formatList(['type', 'source', 'level', '0'])
        }
        const frame = rt.getFrame(n)
        if (!frame) {
          throw new Error(`bad level "${n}"`)
        }
        return formatList(['type', 'proc', 'level', String(rt.callStack.length - n), 'namespace', frame.ns.path()])
      },

      // info cmdcount - number of commands executed (placeholder)
      cmdcount: () => '0',

      // info complete script - check if script is complete
      complete: () => {
        // Simplified: check for balanced braces/brackets/quotes
        const script = rest[0] || ''
        let braces = 0,
          brackets = 0,
          inQuote = false
        for (let i = 0; i < script.length; i++) {
          const c = script[i]
          if (c === '\\') {
            i++
            continue
          }
          if (c === '"' && !inQuote) inQuote = true
          else if (c === '"' && inQuote) inQuote = false
          else if (!inQuote) {
            if (c === '{') braces++
            else if (c === '}') braces--
            else if (c === '[') brackets++
            else if (c === ']') brackets--
          }
        }
        return braces === 0 && brackets === 0 && !inQuote ? '1' : '0'
      },

      // info hostname - get hostname
      hostname: () => {
        if (typeof process !== 'undefined' && process.env) {
          return process.env.HOSTNAME || 'localhost'
        }
        return 'localhost'
      },

      // info nameofexecutable - get executable path
      nameofexecutable: () => {
        if (typeof process !== 'undefined') {
          return process.execPath || 'node'
        }
        return ''
      },

      // info patchlevel - Tcl version
      patchlevel: () => '9.0.0',

      // info tclversion - Tcl version
      tclversion: () => '9.0',

      // info script ?filename? - get/set script being evaluated
      script: () => rest[0] || '',

      // info sharedlibextension - shared library extension
      sharedlibextension: () => {
        if (typeof process !== 'undefined') {
          if (process.platform === 'darwin') return '.dylib'
          if (process.platform === 'win32') return '.dll'
          return '.so'
        }
        return '.so'
      },

      // info namespace - namespace introspection (delegate to namespace command)
      namespace: () => {
        throw new Error('Use "namespace" command for namespace introspection')
      },
    }

    if (!subcmd || !subcommands[subcmd]) {
      const available = Object.keys(subcommands).join(', ')
      throw new Error(`unknown or ambiguous subcommand "${subcmd}": must be ${available}`)
    }

    return subcommands[subcmd]()
  },
}
