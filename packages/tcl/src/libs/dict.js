// Dict commands - strings that represent key-value pairs (EIAS)
// Dicts are plists: lists with even elements alternating key/value

import { parseList, formatList } from './list.js'
import { RC } from '../tok.js'
import { globToRegex } from '../glob.js'

// Parse a dict string into a Map
function parseDict(str) {
  const list = parseList(str)
  if (list.length % 2 !== 0) {
    throw new Error('dict: missing value to go with key')
  }
  const dict = new Map()
  for (let i = 0; i < list.length; i += 2) {
    dict.set(list[i], list[i + 1])
  }
  return dict
}

// Format a Map into a dict string
function formatDict(map) {
  const list = []
  for (const [k, v] of map) {
    list.push(k, v)
  }
  return formatList(list)
}

// Get nested value from dict
function dictGetPath(dictStr, keys) {
  let current = dictStr
  for (const key of keys) {
    const dict = parseDict(current)
    if (!dict.has(key)) {
      throw new Error(`key "${key}" not known in dictionary`)
    }
    current = dict.get(key)
  }
  return current
}

// Set nested value in dict, returns new dict string
function dictSetPath(dictStr, keys, value) {
  if (keys.length === 0) return value

  const dict = parseDict(dictStr || '')
  const key = keys[0]

  if (keys.length === 1) {
    dict.set(key, value)
  } else {
    const nested = dict.has(key) ? dict.get(key) : ''
    dict.set(key, dictSetPath(nested, keys.slice(1), value))
  }

  return formatDict(dict)
}

export const dict = {
  // dict create ?key value ...? - create dict
  'dict create': args => {
    if (args.length % 2 !== 0) {
      throw new Error('dict create: wrong # args')
    }
    return formatList(args)
  },

  // dict get dict ?key ...? - get value
  'dict get': args => {
    const [dictStr, ...keys] = args
    if (keys.length === 0) return dictStr
    return dictGetPath(dictStr, keys)
  },

  // dict set varName key ?key ...? value - set value in dict variable
  'dict set': (args, rt) => {
    const varName = args[0]
    const keys = args.slice(1, -1)
    const value = args[args.length - 1]

    let dictStr
    try {
      dictStr = rt.getVar(varName)
    } catch {
      dictStr = ''
    }

    const result = dictSetPath(dictStr, keys, value)
    rt.setVar(varName, result)
    return result
  },

  // dict unset varName key ?key ...? - remove key from dict
  'dict unset': (args, rt) => {
    const varName = args[0]
    const keys = args.slice(1)

    let dictStr
    try {
      dictStr = rt.getVar(varName)
    } catch {
      dictStr = ''
    }

    if (keys.length === 0) return dictStr

    // For nested unset, we need to navigate and remove
    const unsetPath = (str, keys) => {
      const dict = parseDict(str)
      if (keys.length === 1) {
        dict.delete(keys[0])
      } else if (dict.has(keys[0])) {
        dict.set(keys[0], unsetPath(dict.get(keys[0]), keys.slice(1)))
      }
      return formatDict(dict)
    }

    const result = unsetPath(dictStr, keys)
    rt.setVar(varName, result)
    return result
  },

  // dict exists dict key ?key ...? - check if key exists
  'dict exists': args => {
    const [dictStr, ...keys] = args
    try {
      dictGetPath(dictStr, keys)
      return '1'
    } catch {
      return '0'
    }
  },

  // dict keys dict ?pattern? - list keys
  'dict keys': args => {
    const [dictStr, pattern] = args
    const dict = parseDict(dictStr)
    let keys = [...dict.keys()]
    if (pattern) {
      const regex = globToRegex(pattern)
      keys = keys.filter(k => regex.test(k))
    }
    return formatList(keys)
  },

  // dict values dict ?pattern? - list values
  'dict values': args => {
    const [dictStr, pattern] = args
    const dict = parseDict(dictStr)
    let values = [...dict.values()]
    if (pattern) {
      const regex = globToRegex(pattern)
      values = values.filter(v => regex.test(v))
    }
    return formatList(values)
  },

  // dict size dict - count keys
  'dict size': ([dictStr]) => String(parseDict(dictStr).size),

  // dict for {keyVar valVar} dict body - iterate
  'dict for': async ([varsStr, dictStr, body], rt) => {
    const vars = parseList(varsStr)
    if (vars.length !== 2) {
      throw new Error('dict for: must have exactly two variable names')
    }
    const [keyVar, valVar] = vars
    const dict = parseDict(dictStr)
    let result = ''

    for (const [key, value] of dict) {
      rt.setVar(keyVar, key)
      rt.setVar(valVar, value)
      try {
        result = await rt.run(body)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
    }
    return result
  },

  // dict map {keyVar valVar} dict body - functional map
  'dict map': async ([varsStr, dictStr, body], rt) => {
    const vars = parseList(varsStr)
    if (vars.length !== 2) {
      throw new Error('dict map: must have exactly two variable names')
    }
    const [keyVar, valVar] = vars
    const dict = parseDict(dictStr)
    const result = new Map()

    for (const [key, value] of dict) {
      rt.setVar(keyVar, key)
      rt.setVar(valVar, value)
      try {
        const newValue = await rt.run(body)
        result.set(key, newValue)
      } catch (e) {
        if (e === RC.BREAK) break
        if (e !== RC.CONTINUE) throw e
      }
    }
    return formatDict(result)
  },

  // dict filter dict filterType arg - filter entries
  'dict filter': async (args, rt) => {
    const [dictStr, filterType, ...rest] = args
    const dict = parseDict(dictStr)
    const result = new Map()

    if (filterType === 'key') {
      const pattern = rest[0]
      const regex = globToRegex(pattern)
      for (const [key, value] of dict) {
        if (regex.test(key)) result.set(key, value)
      }
    } else if (filterType === 'value') {
      const pattern = rest[0]
      const regex = globToRegex(pattern)
      for (const [key, value] of dict) {
        if (regex.test(value)) result.set(key, value)
      }
    } else if (filterType === 'script') {
      const [varsStr, script] = rest
      const vars = parseList(varsStr)
      const [keyVar, valVar] = vars
      for (const [key, value] of dict) {
        rt.setVar(keyVar, key)
        rt.setVar(valVar, value)
        const scriptResult = await rt.run(script)
        if (scriptResult !== '0' && scriptResult !== '') {
          result.set(key, value)
        }
      }
    }

    return formatDict(result)
  },

  // dict merge ?dict ...? - merge dicts
  'dict merge': args => {
    const result = new Map()
    for (const dictStr of args) {
      const dict = parseDict(dictStr)
      for (const [key, value] of dict) {
        result.set(key, value)
      }
    }
    return formatDict(result)
  },

  // dict append varName key ?string ...? - append to value
  'dict append': (args, rt) => {
    const [varName, key, ...strings] = args
    let dictStr
    try {
      dictStr = rt.getVar(varName)
    } catch {
      dictStr = ''
    }

    const dict = parseDict(dictStr)
    const current = dict.get(key) || ''
    dict.set(key, current + strings.join(''))
    const result = formatDict(dict)
    rt.setVar(varName, result)
    return dict.get(key)
  },

  // dict incr varName key ?increment? - increment value
  'dict incr': (args, rt) => {
    const [varName, key, increment = '1'] = args
    let dictStr
    try {
      dictStr = rt.getVar(varName)
    } catch {
      dictStr = ''
    }

    const dict = parseDict(dictStr)
    const current = parseInt(dict.get(key) || '0')
    const newValue = String(current + parseInt(increment))
    dict.set(key, newValue)
    const result = formatDict(dict)
    rt.setVar(varName, result)
    return newValue
  },

  // dict lappend varName key ?value ...? - append to list value
  'dict lappend': (args, rt) => {
    const [varName, key, ...values] = args
    let dictStr
    try {
      dictStr = rt.getVar(varName)
    } catch {
      dictStr = ''
    }

    const dict = parseDict(dictStr)
    const current = parseList(dict.get(key) || '')
    current.push(...values)
    dict.set(key, formatList(current))
    const result = formatDict(dict)
    rt.setVar(varName, result)
    return dict.get(key)
  },

  // dict replace dict ?key value ...? - return modified copy
  'dict replace': args => {
    const [dictStr, ...pairs] = args
    if (pairs.length % 2 !== 0) {
      throw new Error('dict replace: wrong # args')
    }
    const dict = parseDict(dictStr)
    for (let i = 0; i < pairs.length; i += 2) {
      dict.set(pairs[i], pairs[i + 1])
    }
    return formatDict(dict)
  },

  // dict remove dict ?key ...? - return copy with keys removed
  'dict remove': args => {
    const [dictStr, ...keys] = args
    const dict = parseDict(dictStr)
    for (const key of keys) {
      dict.delete(key)
    }
    return formatDict(dict)
  },

  // dict update varName key varName ... body - local vars for keys
  'dict update': async (args, rt) => {
    const varName = args[0]
    const body = args[args.length - 1]
    const mappings = args.slice(1, -1)

    if (mappings.length % 2 !== 0) {
      throw new Error('dict update: wrong # args')
    }

    let dictStr = rt.getVar(varName)
    const dict = parseDict(dictStr)

    // Set local variables from dict
    for (let i = 0; i < mappings.length; i += 2) {
      const key = mappings[i]
      const localVar = mappings[i + 1]
      if (dict.has(key)) {
        rt.setVar(localVar, dict.get(key))
      }
    }

    // Run body, capturing any control flow exceptions
    let result
    let controlFlowException = null

    try {
      result = await rt.run(body)
    } catch (e) {
      if (e === RC.RETURN || e === RC.BREAK || e === RC.CONTINUE) {
        controlFlowException = e
      } else {
        throw e
      }
    }

    // Update dict from local variables (even if control flow exception occurred)
    for (let i = 0; i < mappings.length; i += 2) {
      const key = mappings[i]
      const localVar = mappings[i + 1]
      try {
        dict.set(key, rt.getVar(localVar))
      } catch {
        dict.delete(key)
      }
    }

    rt.setVar(varName, formatDict(dict))

    // Re-throw control flow exception after updating dict
    if (controlFlowException) {
      throw controlFlowException
    }

    return result
  },

  // dict with varName ?key ...? body - expose keys as vars
  'dict with': async (args, rt) => {
    const varName = args[0]
    const body = args[args.length - 1]
    const keys = args.slice(1, -1)

    let dictStr = rt.getVar(varName)

    // Navigate to nested dict if keys provided
    if (keys.length > 0) {
      dictStr = dictGetPath(dictStr, keys)
    }

    const dict = parseDict(dictStr)

    // Set local variables from dict keys
    for (const [key, value] of dict) {
      rt.setVar(key, value)
    }

    // Run body, capturing any control flow exceptions
    let result
    let controlFlowException = null

    try {
      result = await rt.run(body)
    } catch (e) {
      if (e === RC.RETURN || e === RC.BREAK || e === RC.CONTINUE) {
        controlFlowException = e
      } else {
        throw e
      }
    }

    // Update dict from local variables (even if control flow exception occurred)
    for (const key of dict.keys()) {
      try {
        dict.set(key, rt.getVar(key))
      } catch {
        // Variable was unset, remove from dict
        dict.delete(key)
      }
    }

    // Write back
    if (keys.length > 0) {
      const rootStr = rt.getVar(varName)
      rt.setVar(varName, dictSetPath(rootStr, keys, formatDict(dict)))
    } else {
      rt.setVar(varName, formatDict(dict))
    }

    // Re-throw control flow exception after updating dict
    if (controlFlowException) {
      throw controlFlowException
    }

    return result
  },
}

// Export dict as an ensemble command
export const dictCmd = {
  dict: (args, rt) => {
    const [subcmd, ...rest] = args
    const cmdName = `dict ${subcmd}`
    if (!dict[cmdName]) {
      throw new Error(`unknown or ambiguous subcommand "${subcmd}"`)
    }
    return dict[cmdName](rest, rt)
  },
}
