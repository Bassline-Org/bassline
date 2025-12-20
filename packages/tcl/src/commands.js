/**
 * Standard commands for the Tcl interpreter.
 *
 * These can be loaded into an interpreter instance.
 * All commands receive (args, interp) and return a string.
 */

import { parseTclList } from './tcl.js'

/**
 * Create a variable store and return vlookup/set commands.
 * @returns {object} Commands for variable management
 */
export function createVariableCommands() {
  const store = {}

  return {
    // Look up a variable (used by $var substitution)
    vlookup(args) {
      const name = args[0]
      if (!(name in store)) {
        throw new Error(`Unknown variable: ${name}`)
      }
      return store[name]
    },

    // Set a variable
    set(args) {
      const [name, value] = args
      if (args.length === 1) {
        return store[name] ?? ''
      }
      store[name] = value
      return value
    },

    // Unset a variable
    unset(args) {
      delete store[args[0]]
      return ''
    },
  }
}

/**
 * Tcl list commands.
 * Lists are space-separated strings: {a b c d e}
 *
 * Examples:
 *   list a b c           → "a b c"
 *   lrange {a b c d e} 1 3  → "b c d"
 */
export const listCommands = {
  // Create a list from args
  list(args) {
    return args.join(' ')
  },

  // Get element at index
  lindex(args) {
    const [listStr, indexStr] = args
    const items = parseTclList(listStr)
    const index = parseInt(indexStr, 10)
    return items[index] ?? ''
  },

  // Get list length
  llength(args) {
    const items = parseTclList(args[0])
    return String(items.length)
  },

  // Get range of list
  lrange(args) {
    const [listStr, startStr, endStr] = args
    const items = parseTclList(listStr)
    const start = parseInt(startStr, 10)
    const end = endStr === 'end' ? items.length - 1 : parseInt(endStr, 10)
    return items.slice(start, end + 1).join(' ')
  },

  // Append to list variable
  lappend(args, interp) {
    const [varName, ...values] = args
    const current = interp.commands.vlookup?.([varName], interp) ?? ''
    const items = current ? parseTclList(current) : []
    items.push(...values)
    const newList = items.join(' ')
    interp.commands.set?.([varName, newList], interp)
    return newList
  },
}

/**
 * JSON commands for boundary interactions.
 * Uses explicit type commands (rl_json style).
 *
 * Type commands return JSON fragments:
 *   jstr hello              → "hello"
 *   jnum 42                 → 42
 *   jbool true              → true
 *   jnull                   → null
 *
 * Compound commands take JSON fragments as values:
 *   jobj name [jstr alice] age [jnum 30]  → {"name":"alice","age":30}
 *   jarr [jstr a] [jnum 1]                → ["a",1]
 *
 * Access:
 *   jget $json key          → extracts value as JSON fragment
 */
export const jsonCommands = {
  // JSON string
  jstr(args) {
    return JSON.stringify(args[0] ?? '')
  },

  // JSON number
  jnum(args) {
    const n = Number(args[0])
    if (Number.isNaN(n)) {
      throw new Error(`jnum: invalid number: ${args[0]}`)
    }
    return String(n)
  },

  // JSON boolean
  jbool(args) {
    const v = args[0]?.toLowerCase()
    if (v === 'true' || v === '1' || v === 'yes') return 'true'
    if (v === 'false' || v === '0' || v === 'no' || v === '') return 'false'
    throw new Error(`jbool: invalid boolean: ${args[0]}`)
  },

  // JSON null
  jnull() {
    return 'null'
  },

  // Create JSON object from alternating key/value args
  // Values must be JSON fragments (from jstr, jnum, jbool, jnull, jobj, jarr)
  jobj(args) {
    const pairs = []
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]
      const value = args[i + 1] ?? 'null'
      pairs.push(`${JSON.stringify(key)}:${value}`)
    }
    return `{${pairs.join(',')}}`
  },

  // Create JSON array from args
  // Values must be JSON fragments
  jarr(args) {
    return `[${args.join(',')}]`
  },

  // Get a value from a JSON object/array
  // Returns the value as a JSON fragment
  jget(args) {
    const [jsonStr, key] = args
    const obj = JSON.parse(jsonStr)
    const value = obj[key]
    if (value === undefined) return ''
    return JSON.stringify(value)
  },
}

/**
 * Control flow commands.
 */
export const controlCommands = {
  // Conditional
  // Usage: if condition body ?else elseBody?
  // Condition is evaluated if it looks like a script, otherwise treated as value
  async if(args, interp) {
    const [cond, thenBody, elseKeyword, elseBody] = args

    // Determine if condition is truthy
    // If cond contains commands/substitutions, it was already evaluated during arg substitution
    // So by the time we get here, cond is just a value string
    const isTrue = cond !== '' && cond !== '0' && cond !== 'false'

    if (isTrue) {
      return await interp.run(thenBody)
    } else if (elseKeyword === 'else' && elseBody) {
      return await interp.run(elseBody)
    }
    return ''
  },

  // While loop
  async while(args, interp) {
    const [cond, body] = args
    let result = ''

    while (true) {
      const condResult = await interp.run(cond)
      if (condResult === '' || condResult === '0' || condResult === 'false') {
        break
      }
      result = await interp.run(body)
    }
    return result
  },

  // For each - iterates over a Tcl list
  async foreach(args, interp) {
    const [varName, listStr, body] = args
    const items = parseTclList(listStr)
    let result = ''

    for (const item of items) {
      interp.commands.set([varName, item], interp)
      result = await interp.run(body)
    }
    return result
  },
}

/**
 * Procedure definition.
 */
export const procCommand = {
  proc(args, interp) {
    const [name, params, body] = args
    const paramList = params ? params.split(' ').filter(Boolean) : []

    interp.register(name, async (callArgs, callInterp) => {
      // Bind parameters as variables
      for (let i = 0; i < paramList.length; i++) {
        callInterp.commands.set([paramList[i], callArgs[i] ?? ''], callInterp)
      }
      return await callInterp.run(body)
    })

    return ''
  },
}

/**
 * String commands.
 */
export const stringCommands = {
  concat(args) {
    return args.join('')
  },

  string(args) {
    const [subcmd, ...rest] = args

    switch (subcmd) {
      case 'length':
        return String(rest[0]?.length ?? 0)

      case 'index':
        return rest[0]?.[parseInt(rest[1], 10)] ?? ''

      case 'range': {
        const [str, start, end] = rest
        const endIdx = end === 'end' ? str.length : parseInt(end, 10) + 1
        return str.slice(parseInt(start, 10), endIdx)
      }

      case 'equal':
        return rest[0] === rest[1] ? '1' : '0'

      case 'match': {
        // Simple glob matching
        const pattern = rest[0]
        const str = rest[1]
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        return regex.test(str) ? '1' : '0'
      }

      default:
        throw new Error(`string: unknown subcommand ${subcmd}`)
    }
  },
}

/**
 * Math/expression commands.
 */
export const mathCommands = {
  expr(args) {
    const expr = args.join(' ')
    // Only allow safe characters
    if (!/^[\d\s+\-*/().%<>=!&|]+$/.test(expr)) {
      throw new Error(`expr: invalid expression`)
    }
    // Use Function instead of eval for slightly better isolation
    const result = new Function(`return (${expr})`)()
    return String(result)
  },

  incr(args, interp) {
    const [varName, amountStr] = args
    const amount = amountStr ? parseInt(amountStr, 10) : 1
    const current = parseInt(interp.commands.vlookup([varName], interp) || '0', 10)
    const newValue = String(current + amount)
    interp.commands.set([varName, newValue], interp)
    return newValue
  },
}

/**
 * Utility commands.
 */
export const utilCommands = {
  puts(args) {
    console.log(args.join(' '))
    return ''
  },

  return(args) {
    return args[0] ?? ''
  },

  // Do nothing, return empty
  noop() {
    return ''
  },
}

/**
 * Load all standard commands into an interpreter.
 * @param {object} interp - Interpreter instance
 */
export function loadStandardCommands(interp) {
  const varCmds = createVariableCommands()

  const allCommands = {
    ...varCmds,
    ...listCommands,
    ...jsonCommands,
    ...controlCommands,
    ...procCommand,
    ...stringCommands,
    ...mathCommands,
    ...utilCommands,
  }

  for (const [name, fn] of Object.entries(allCommands)) {
    interp.register(name, fn)
  }
}
