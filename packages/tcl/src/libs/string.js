import { std } from './std.js'

import { parseList } from './list.js'

export const commands = {
  length: ([str]) => String(str?.length ?? 0),
  concat: ([...strs]) => strs.join(''),
  // string map {old new old2 new2 ...} string
  map: ([mapping, str]) => {
    const pairs = parseList(mapping)
    let result = str
    for (let i = 0; i < pairs.length; i += 2) {
      const old = pairs[i]
      const replacement = pairs[i + 1] ?? ''
      result = result.split(old).join(replacement)
    }
    return result
  },
  compare: ([a, b]) => String(a === b ? 0 : a < b ? -1 : 1),
  equal: ([a, b]) => String(a === b ? 1 : 0),
  first: ([str]) => String(str?.[0] ?? ''),
  last: ([str]) => String(str?.[str.length - 1] ?? ''),
  index: ([str, index]) => String(str?.[parseInt(index, 10)] ?? ''),
  is: ([type, str]) => {
    switch (type) {
      case 'integer':
        return /^-?\d+$/.test(str) ? '1' : '0'
      case 'double':
      case 'float':
        return !isNaN(parseFloat(str)) && isFinite(str) ? '1' : '0'
      case 'boolean':
      case 'bool':
        return /^(true|false|yes|no|on|off|0|1)$/i.test(str) ? '1' : '0'
      case 'alpha':
        return /^[a-zA-Z]+$/.test(str) ? '1' : '0'
      case 'alnum':
        return /^[a-zA-Z0-9]+$/.test(str) ? '1' : '0'
      case 'digit':
        return /^\d+$/.test(str) ? '1' : '0'
      case 'space':
        return /^\s+$/.test(str) ? '1' : '0'
      case 'list':
        try {
          parseList(str)
          return '1'
        } catch {
          return '0'
        }
      default:
        throw new Error(`string is: unknown class "${type}"`)
    }
  },
  range: ([str, start, end]) => {
    const len = str?.length ?? 0
    const parseIndex = idx => {
      if (idx === 'end') return len - 1
      if (typeof idx === 'string' && idx.startsWith('end-')) {
        return len - 1 - parseInt(idx.slice(4), 10)
      }
      return parseInt(idx, 10)
    }
    const s = parseIndex(start)
    const e = parseIndex(end)
    if (s < 0 || e < s || s >= len) return ''
    return str.slice(s, e + 1) // +1 because Tcl range is inclusive
  },
  repeat: ([str, count]) => {
    let result = ''
    for (let i = 0; i < parseInt(count, 10); i++) {
      result += str
    }
    return result
  },
  replace: ([str, regexStr, repl]) => {
    const match = regexStr.match(/^\/(.*)\/([a-z]*)$/i)
    if (!match) {
      throw new Error('Invalid regex string format. Use /pattern/flags')
    }
    const [, pattern, flags] = match
    return String(str.replace(new RegExp(pattern, flags), repl))
  },
  reverse: ([str]) => str.split('').reverse().join(''),
  tolower: ([str]) => str.toLowerCase(),
  toupper: ([str]) => str.toUpperCase(),
  trim: ([str]) => str.trim(),
  trimleft: ([str]) => str.trimLeft(),
  trimright: ([str]) => str.trimRight(),
  wordstart: ([str]) => str.search(/\s\w/),
  wordend: ([str]) => str.search(/\w\b/),
}

export const stringCommand = ([subcmd, ...rest]) => {
  return commands[subcmd](rest) ?? std.puts(`string: unknown subcommand ${subcmd}`)
}

export const string = {
  string: stringCommand,
}
