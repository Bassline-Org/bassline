import { TT, tokenize, RC } from './tok.js'
import { TclError } from './error.js'

// Escape sequence interpretation
const escapes = {
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
}

function interpretEscape(seq) {
  if (seq.length < 2) return seq
  const char = seq[1]
  if (char in escapes) return escapes[char]
  if (char === 'x') {
    const hex = seq.slice(2, 4)
    return String.fromCharCode(parseInt(hex, 16) || 0)
  }
  if (char >= '0' && char <= '7') {
    const match = seq.slice(1).match(/^[0-7]{1,3}/)
    return String.fromCharCode(parseInt(match[0], 8))
  }
  return char
}

class Namespace {
  constructor(name = '', parent = null) {
    this.name = name
    this.parent = parent
    this.children = new Map()
    this.commands = new Map()
    this.variables = new Map()
    this.links = new Map() // Variable links for upvar/global
    this.exports = new Set() // Exported command patterns
    this.imports = new Map() // Imported commands
  }

  child(name) {
    if (!this.children.has(name)) {
      this.children.set(name, new Namespace(name, this))
    }
    return this.children.get(name)
  }

  path() {
    if (!this.parent) return '/'
    const parentPath = this.parent.path()
    return parentPath === '/' ? `/${this.name}` : `${parentPath}/${this.name}`
  }
}

export class Runtime {
  constructor() {
    this.root = new Namespace()
    this.current = this.root
    this.result = ''
    this.callStack = [] // Track call frames for uplevel/upvar
    this.traces = new Map() // Variable traces: varPath -> [{ops, callback}]
    this.afterEvents = new Map() // Scheduled events: id -> {script, timeout}
    this.afterId = 0 // Counter for after event IDs
    this.inTrace = false // Reentrancy guard for trace callbacks
  }

  // Get the canonical path for a variable (for trace lookup)
  varPath(name) {
    const [ns, localName] = this.resolveVar(name)
    return ns.path() === '/' ? `/${localName}` : `${ns.path()}/${localName}`
  }

  // Add a variable trace
  // ops: array of 'read', 'write', 'unset'
  addTrace(varName, ops, callback) {
    const path = this.varPath(varName)
    if (!this.traces.has(path)) {
      this.traces.set(path, [])
    }
    this.traces.get(path).push({ ops, callback })
  }

  // Remove a variable trace
  removeTrace(varName, ops, callback) {
    const path = this.varPath(varName)
    const traces = this.traces.get(path)
    if (!traces) return
    const idx = traces.findIndex(
      t => t.callback === callback && t.ops.length === ops.length && t.ops.every((o, i) => o === ops[i])
    )
    if (idx !== -1) traces.splice(idx, 1)
    if (traces.length === 0) this.traces.delete(path)
  }

  // Get traces for a variable
  getTraces(varName) {
    const path = this.varPath(varName)
    return this.traces.get(path) || []
  }

  // Fire traces for an operation
  fireTraces(varName, op, oldValue, newValue) {
    // Reentrancy guard - prevent infinite recursion when trace callbacks
    // set variables that themselves have traces
    if (this.inTrace) return

    const path = this.varPath(varName)
    const traces = this.traces.get(path)
    if (!traces) return

    this.inTrace = true
    try {
      for (const { ops, callback } of traces) {
        if (ops.includes(op)) {
          callback(varName, op, oldValue, newValue)
        }
      }
    } finally {
      this.inTrace = false
    }
  }

  // Push a new call frame
  pushFrame(ns) {
    this.callStack.push({ ns, saved: this.current })
  }

  // Pop a call frame
  popFrame() {
    return this.callStack.pop()
  }

  // Get call frame at level (1 = caller, 2 = caller's caller, etc.)
  // #N means absolute level from bottom
  getFrame(level) {
    if (typeof level === 'string' && level.startsWith('#')) {
      const n = parseInt(level.slice(1))
      return this.callStack[n]
    }
    const idx = this.callStack.length - level
    return idx >= 0 ? this.callStack[idx] : null
  }

  resolve(path, create = false) {
    const isAbsolute = path.startsWith('/')
    const parts = path.split('/').filter(Boolean)

    let ns = isAbsolute ? this.root : this.current
    for (const part of parts) {
      if (create) {
        ns = ns.child(part)
      } else {
        ns = ns.children.get(part)
        if (!ns) return null
      }
    }
    return ns
  }

  // Parse a qualified name into namespace path + local name
  // "foo" -> [current, "foo"]
  // "bar/foo" -> [bar, "foo"]
  // "/abs/path/foo" -> [/abs/path, "foo"]
  parseName(name) {
    const lastSlash = name.lastIndexOf('/')
    if (lastSlash === -1) {
      return [this.current, name]
    }
    const nsPath = name.slice(0, lastSlash) || '/'
    const localName = name.slice(lastSlash + 1)
    const ns = this.resolve(nsPath, false)
    return [ns, localName]
  }

  // Resolve variable links - returns [namespace, localName] after following links
  resolveVar(name) {
    let [ns, localName] = this.parseName(name)
    if (!ns) ns = this.current

    // Follow links with cycle detection
    const visited = new Set()
    while (ns.links && ns.links.has(localName)) {
      const key = `${ns.path()}:${localName}`
      if (visited.has(key)) {
        throw new Error(`circular variable link detected for '${localName}'`)
      }
      visited.add(key)
      const link = ns.links.get(localName)
      ns = link.ns
      localName = link.name
    }
    return [ns, localName]
  }

  getVar(name) {
    const [ns, localName] = this.resolveVar(name)
    if (!ns.variables.has(localName)) {
      throw new Error(`No such variable '${name}'`)
    }
    const value = ns.variables.get(localName)
    this.fireTraces(name, 'read', value, value)
    return value
  }

  setVar(name, value) {
    const [ns, localName] = this.resolveVar(name)
    const oldValue = ns.variables.get(localName)
    ns.variables.set(localName, value)
    this.fireTraces(name, 'write', oldValue, value)
    return value
  }

  unsetVar(name) {
    const [ns, localName] = this.resolveVar(name)
    const oldValue = ns.variables.get(localName)
    ns.variables.delete(localName)
    this.fireTraces(name, 'unset', oldValue, undefined)
  }

  getCmd(name) {
    const [ns, localName] = this.parseName(name)

    if (name.includes('/')) {
      if (!ns || !ns.commands.has(localName)) {
        throw new Error(`No such command '${name}'`)
      }
      return ns.commands.get(localName)
    }

    let current = this.current
    while (current) {
      if (current.commands.has(name)) {
        return current.commands.get(name)
      }
      current = current.parent
    }
    throw new Error(`No such command '${name}'`)
  }

  register(name, fn) {
    const lastSlash = name.lastIndexOf('/')
    if (lastSlash === -1) {
      this.current.commands.set(name, fn)
    } else {
      const nsPath = name.slice(0, lastSlash) || '/'
      const localName = name.slice(lastSlash + 1)
      const ns = this.resolve(nsPath, true)
      ns.commands.set(localName, fn)
    }
    return this
  }

  // Evaluate a single token's value
  eval({ t, v }) {
    switch (t) {
      case TT.STR:
      case TT.BRC:
        return v
      case TT.ESC:
        return interpretEscape(v)
      case TT.VAR:
        return this.getVar(v)
      case TT.ARR: {
        const { name, index, literal } = v
        const arr = this.getVar(name)
        if (typeof arr !== 'object' || arr === null) {
          throw new Error(`'${name}' is not an array`)
        }
        const key = literal ? index : this.subst(index)
        if (!(key in arr)) throw new Error(`No such element '${key}' in array '${name}'`)
        return arr[key]
      }
      case TT.CMD:
        return this.run(v)
    }
  }

  // Apply substitutions only (no command execution)
  subst(src) {
    let result = ''
    for (const tok of tokenize(src)) {
      const val = this.eval(tok)
      if (val !== undefined) result += val
    }
    return result
  }

  // Safely call a command, wrapping errors in TclError
  safeCall(cmdName, cmd, args) {
    try {
      return cmd(args, this)
    } catch (err) {
      // Re-throw control flow exceptions as-is
      if (err === RC.RETURN || err === RC.BREAK || err === RC.CONTINUE) {
        throw err
      }
      // Wrap other errors in TclError with context
      throw TclError.from(err, { command: cmdName })
    }
  }

  // Run a script (full command evaluation)
  run(src) {
    let argv = []
    let prev = TT.EOL
    this.result = ''

    try {
      for (const tok of tokenize(src)) {
        const { t } = tok

        if (t === TT.SEP) {
          prev = t
          continue
        }

        if (t === TT.EOL || t === TT.EOF) {
          if (argv.length) {
            const cmdName = argv[0]
            const cmd = this.getCmd(cmdName)
            this.result = this.safeCall(cmdName, cmd, argv.slice(1)) ?? this.result
          }
          argv = []
          prev = t
          continue
        }

        const val = this.eval(tok)
        if (prev === TT.SEP || prev === TT.EOL) {
          argv.push(val)
        } else {
          argv[argv.length - 1] += val
        }
        prev = t
      }
    } catch (err) {
      // Re-throw control flow exceptions as-is
      if (err === RC.RETURN || err === RC.BREAK || err === RC.CONTINUE) {
        throw err
      }
      // Re-throw TclErrors as-is
      if (err instanceof TclError) {
        throw err
      }
      // Wrap tokenizer and other errors
      throw TclError.from(err, { script: src.length > 100 ? src.slice(0, 100) + '...' : src })
    }
    return this.result
  }

  enter(path) {
    const ns = this.resolve(path, true)
    this.current = ns
    return ns.path()
  }

  pwd() {
    return this.current.path()
  }
}
