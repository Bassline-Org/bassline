// Namespace commands - Phase 1 of stdlib

export const namespace = {
  // namespace subcommand ?args...?
  // This is an ensemble command that dispatches to subcommands
  namespace: (args, rt) => {
    const [subcmd, ...rest] = args
    const subcommands = {
      // namespace eval path script - evaluate script in namespace
      eval: () => {
        const [path, script] = rest
        const saved = rt.current
        rt.current = rt.resolve(path, true)
        try {
          return rt.run(script)
        } finally {
          rt.current = saved
        }
      },

      // namespace current - return current namespace path
      current: () => rt.pwd(),

      // namespace parent ?ns? - return parent namespace path
      parent: () => {
        const ns = rest[0] ? rt.resolve(rest[0]) : rt.current
        if (!ns) throw new Error(`Namespace '${rest[0]}' does not exist`)
        return ns.parent ? ns.parent.path() : ''
      },

      // namespace children ?ns? ?pattern? - list child namespaces
      children: () => {
        const ns = rest[0] ? rt.resolve(rest[0]) : rt.current
        if (!ns) throw new Error(`Namespace '${rest[0]}' does not exist`)
        const pattern = rest[1]
        const children = [...ns.children.keys()].map(name => {
          const childPath = ns.path()
          return childPath === '/' ? `/${name}` : `${childPath}/${name}`
        })
        if (pattern) {
          const regex = globToRegex(pattern)
          return children.filter(c => regex.test(c)).join(' ')
        }
        return children.join(' ')
      },

      // namespace exists ns - check if namespace exists
      exists: () => {
        const ns = rt.resolve(rest[0])
        return ns ? '1' : '0'
      },

      // namespace delete ?ns ...? - delete namespaces
      delete: () => {
        for (const path of rest) {
          const ns = rt.resolve(path)
          if (ns && ns.parent) {
            ns.parent.children.delete(ns.name)
          }
        }
        return ''
      },

      // namespace qualifiers name - return namespace part of qualified name
      qualifiers: () => {
        const name = rest[0] || ''
        const lastSlash = name.lastIndexOf('/')
        if (lastSlash === -1) return ''
        return name.slice(0, lastSlash) || '/'
      },

      // namespace tail name - return simple name part
      tail: () => {
        const name = rest[0] || ''
        const lastSlash = name.lastIndexOf('/')
        return lastSlash === -1 ? name : name.slice(lastSlash + 1)
      },

      // namespace which ?-command|-variable? name - resolve full path
      which: () => {
        let type = 'command'
        let name = rest[0]
        if (rest[0] === '-command' || rest[0] === '-variable') {
          type = rest[0].slice(1)
          name = rest[1]
        }

        if (type === 'command') {
          // Walk up namespace hierarchy to find command
          let ns = rt.current
          while (ns) {
            if (ns.commands.has(name)) {
              return ns.path() === '/' ? `/${name}` : `${ns.path()}/${name}`
            }
            ns = ns.parent
          }
          return ''
        } else {
          // Variable lookup
          const [ns, localName] = rt.parseName(name)
          if (ns && ns.variables.has(localName)) {
            return ns.path() === '/' ? `/${localName}` : `${ns.path()}/${localName}`
          }
          return ''
        }
      },

      // namespace export ?-clear? ?pattern ...?
      export: () => {
        let patterns = rest
        if (rest[0] === '-clear') {
          rt.current.exports = new Set()
          patterns = rest.slice(1)
        }
        if (!rt.current.exports) rt.current.exports = new Set()
        for (const pattern of patterns) {
          rt.current.exports.add(pattern)
        }
        return [...(rt.current.exports || [])].join(' ')
      },

      // namespace import ?-force? ?pattern ...?
      import: () => {
        let force = false
        let patterns = rest
        if (rest[0] === '-force') {
          force = true
          patterns = rest.slice(1)
        }
        if (!rt.current.imports) rt.current.imports = new Map()

        for (const pattern of patterns) {
          // Pattern like /foo/bar/cmd or /foo/bar/*
          const lastSlash = pattern.lastIndexOf('/')
          const nsPath = pattern.slice(0, lastSlash) || '/'
          const cmdPattern = pattern.slice(lastSlash + 1)
          const sourceNs = rt.resolve(nsPath)
          if (!sourceNs) throw new Error(`Namespace '${nsPath}' does not exist`)

          const regex = globToRegex(cmdPattern)
          for (const [cmdName, cmdFn] of sourceNs.commands) {
            if (regex.test(cmdName)) {
              // Check if exported
              const isExported =
                sourceNs.exports?.has(cmdName) || [...(sourceNs.exports || [])].some(p => globToRegex(p).test(cmdName))
              if (!isExported && sourceNs.exports?.size > 0) continue

              if (rt.current.commands.has(cmdName) && !force) {
                throw new Error(`Command '${cmdName}' already exists`)
              }
              rt.current.commands.set(cmdName, cmdFn)
              rt.current.imports.set(cmdName, pattern)
            }
          }
        }
        return ''
      },

      // namespace forget ?pattern ...?
      forget: () => {
        if (!rt.current.imports) return ''
        for (const pattern of rest) {
          const regex = globToRegex(pattern)
          for (const [cmdName, source] of rt.current.imports) {
            if (regex.test(source) || regex.test(cmdName)) {
              rt.current.commands.delete(cmdName)
              rt.current.imports.delete(cmdName)
            }
          }
        }
        return ''
      },
    }

    if (!subcmd || !subcommands[subcmd]) {
      throw new Error(`Unknown namespace subcommand: ${subcmd}`)
    }
    return subcommands[subcmd]()
  },

  // variable name ?value? - declare namespace variable
  variable: (args, rt) => {
    const pairs = []
    for (let i = 0; i < args.length; i += 2) {
      const name = args[i]
      const value = args[i + 1]
      if (value !== undefined) {
        rt.current.variables.set(name, value)
      } else if (!rt.current.variables.has(name)) {
        rt.current.variables.set(name, '')
      }
    }
    return ''
  },

  // global name ?name ...? - link to global variables
  global: (args, rt) => {
    if (!rt.current.links) rt.current.links = new Map()
    for (const name of args) {
      // Create a link from current namespace to root namespace
      rt.current.links.set(name, { ns: rt.root, name })
    }
    return ''
  },

  // upvar ?level? otherVar myVar ?otherVar myVar ...?
  upvar: (args, rt) => {
    let level = 1
    let pairs = args
    if (/^#?\d+$/.test(args[0])) {
      level = args[0].startsWith('#') ? parseInt(args[0].slice(1)) : parseInt(args[0])
      pairs = args.slice(1)
    }

    // Get the call frame at the specified level
    const frame = rt.getFrame(level)
    if (!frame) throw new Error(`Bad level "${level}"`)

    if (!rt.current.links) rt.current.links = new Map()
    for (let i = 0; i < pairs.length; i += 2) {
      const otherVar = pairs[i]
      const myVar = pairs[i + 1]
      rt.current.links.set(myVar, { ns: frame.ns, name: otherVar })
    }
    return ''
  },

  // uplevel ?level? script
  uplevel: (args, rt) => {
    let level = 1
    let script = args[0]
    if (/^#?\d+$/.test(args[0]) && args.length > 1) {
      level = args[0].startsWith('#') ? parseInt(args[0].slice(1)) : parseInt(args[0])
      script = args.slice(1).join(' ')
    }

    const frame = rt.getFrame(level)
    if (!frame) throw new Error(`Bad level "${level}"`)

    const saved = rt.current
    rt.current = frame.ns
    try {
      return rt.run(script)
    } finally {
      rt.current = saved
    }
  },
}

// Simple glob pattern to regex
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${regex}$`)
}
