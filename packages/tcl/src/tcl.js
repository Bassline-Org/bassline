// Minimal Tcl-style interpreter for Bassline

export function createInterpreter(options = {}) {
  const commands = options.commands || {}

  async function run(script) {
    let result = ''
    for (const cmd of parseScript(script)) {
      if (cmd.length > 0) result = await evalCommand(cmd)
    }
    return result
  }

  async function evalCommand(words) {
    if (words.length === 0) return ''

    const substituted = []
    for (const w of words) {
      if (isExpansion(w)) {
        substituted.push(...parseTclList(await substitute(w.slice(3))))
      } else {
        substituted.push(await substitute(w))
      }
    }

    const [name, ...args] = substituted
    const cmd = commands[name]
    if (!cmd) throw new Error(`Unknown command: ${name}`)
    return String((await cmd(args, interp)) ?? '')
  }

  async function substitute(word) {
    if (isBraced(word)) return word.slice(1, -1).replace(/\\\n\s*/g, '')

    let result = '',
      i = 0
    while (i < word.length) {
      const ch = word[i]

      if (ch === '\\' && i + 1 < word.length) {
        const [char, len] = parseBackslash(word, i)
        result += char
        i += len
      } else if (ch === '$') {
        const [name, end] = takeWhile(word, i + 1, isWordChar)
        if (name) {
          if (!commands.vlookup) throw new Error('Variable substitution requires vlookup command')
          result += String((await commands.vlookup([name], interp)) ?? '')
        } else {
          result += '$'
        }
        i = end
      } else if (ch === '[') {
        const end = findCloseBracket(word, i + 1)
        result += await run(word.slice(i + 1, end))
        i = end + 1
      } else {
        result += ch
        i++
      }
    }
    return result
  }

  function register(name, fn) {
    commands[name] = fn
  }

  const interp = { run, evalCommand, substitute, register, commands }
  return interp
}

// Predicates
const isWhitespace = (ch) => ch === ' ' || ch === '\t'
const isSeparator = (ch) => ch === '\n' || ch === ';'
const isWordChar = (ch) =>
  (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_'
const isWordBreak = (ch) => ' \t\n;[]{}"'.includes(ch)
const isHexDigit = (ch) =>
  (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')
const isHex = (s, len) => s.length === len && [...s].every(isHexDigit)
const isBraced = (word) => word[0] === '{' && word[word.length - 1] === '}'
const isExpansion = (word) => word.startsWith('{*}') && word.length > 3

// Combinators
const takeWhile = (str, i, pred) => {
  const start = i
  while (i < str.length && pred(str[i])) i++
  return [str.slice(start, i), i]
}

const skipWhile = (str, i, pred) => {
  while (i < str.length && pred(str[i])) i++
  return i
}

// Escape sequences
const ESCAPES = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\x0b', '\\': '\\' }

function parseBackslash(str, i) {
  const next = str[i + 1]
  if (next in ESCAPES) return [ESCAPES[next], 2]
  if (next === 'x') {
    const hex = str.slice(i + 2, i + 4)
    if (isHex(hex, 2)) return [String.fromCharCode(parseInt(hex, 16)), 4]
  }
  if (next === 'u') {
    const hex = str.slice(i + 2, i + 6)
    if (isHex(hex, 4)) return [String.fromCharCode(parseInt(hex, 16)), 6]
  }
  if (next === '\n') return ['', 2]
  return [next, 2]
}

// Script parsing
export function parseScript(script) {
  const commands = []
  let current = [],
    i = 0

  while (i < script.length) {
    const ch = script[i]
    if (isWhitespace(ch)) {
      i++
    } else if (ch === '\\' && script[i + 1] === '\n') {
      i += 2
    } else if (isSeparator(ch)) {
      if (current.length > 0) {
        commands.push(current)
        current = []
      }
      i++
    } else if (ch === '#' && current.length === 0) {
      i = skipWhile(script, i, (c) => c !== '\n')
    } else {
      const [word, next] = readWord(script, i)
      current.push(word)
      i = next
    }
  }

  if (current.length > 0) commands.push(current)
  return commands
}

// Word readers
function readWord(str, i) {
  const ch = str[i]
  if (ch === '{') return readBraced(str, i)
  if (ch === '[') return readBracketed(str, i)
  if (ch === '"') return readQuoted(str, i)
  return readBare(str, i)
}

function readBraced(str, i) {
  const end = findClose(str, i + 1, '{', '}')
  const word = str.slice(i, end + 1)
  if (word === '{*}' && end + 1 < str.length && !isWhitespace(str[end + 1])) {
    const [rest, next] = readWord(str, end + 1)
    return [word + rest, next]
  }
  return [word, end + 1]
}

function readBracketed(str, i) {
  const end = findCloseBracket(str, i + 1)
  return [str.slice(i, end + 1), end + 1]
}

function readQuoted(str, i) {
  let word = '',
    j = i + 1
  while (j < str.length && str[j] !== '"') {
    if (str[j] === '\\' && j + 1 < str.length) word += str[j++]
    word += str[j++]
  }
  return [word, j + 1]
}

function readBare(str, i) {
  const [word, end] = takeWhile(str, i, (ch) => !isWordBreak(ch))
  return [word, end]
}

// Delimiter matching
function findClose(str, i, open, close) {
  let depth = 1
  while (i < str.length && depth > 0) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i += 2
    } else {
      if (str[i] === open) depth++
      else if (str[i] === close) depth--
      i++
    }
  }
  return i - 1
}

function findCloseBracket(str, i) {
  let depth = 1
  while (i < str.length && depth > 0) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i += 2
    } else if (str[i] === '[') {
      depth++
      i++
    } else if (str[i] === ']') {
      depth--
      i++
    } else if (str[i] === '{') {
      i = findClose(str, i + 1, '{', '}') + 1
    } else {
      i++
    }
  }
  return i - 1
}

// List parsing
export function parseTclList(str) {
  if (!str) return []
  const items = []
  let i = 0

  while (i < str.length) {
    i = skipWhile(str, i, isWhitespace)
    if (i >= str.length) break

    if (str[i] === '{') {
      const end = findClose(str, i + 1, '{', '}')
      items.push(str.slice(i + 1, end))
      i = end + 1
    } else if (str[i] === '"') {
      let j = i + 1
      while (j < str.length && str[j] !== '"') {
        if (str[j] === '\\' && j + 1 < str.length) j++
        j++
      }
      items.push(str.slice(i + 1, j))
      i = j + 1
    } else {
      const [word, end] = takeWhile(str, i, (ch) => !isWhitespace(ch))
      items.push(word)
      i = end
    }
  }

  return items
}
