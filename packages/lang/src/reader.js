const WHITESPACE = /\s/
const DIGIT = /\d/
const SYM_START = /[a-zA-Z_+*/=<>!?.]/
const SYM_CHAR = /[a-zA-Z0-9_+*/=<>!?.-]/

export function isSym(x) {
  return x?.tt === 'symbol'
}

const tt =
  type =>
  (val, pos, x = {}) => ({ val, pos, tt: type, ...x })
const string = tt('string')
const number = tt('number')
const symbol = tt('symbol')
const keyword = tt('keyword')
const list = tt('list')
const map = tt('map')
const vector = tt('vector')

export class ReaderError extends Error {}

function skip(src, pos) {
  while (pos < src.length) {
    if (WHITESPACE.test(src[pos])) {
      pos++
      continue
    }
    if (src[pos] === ';') {
      while (pos < src.length && src[pos] !== '\n') pos++
      continue
    }
    break
  }
  return pos
}

function readString(src, pos) {
  pos++ // skip opening "
  let val = ''
  while (pos < src.length && src[pos] !== '"') {
    if (src[pos] === '\\') {
      pos++
      const esc = { n: '\n', t: '\t', '\\': '\\', '"': '"' }
      val += esc[src[pos]] ?? src[pos]
    } else {
      val += src[pos]
    }
    pos++
  }
  return string(val, pos + 1) // skip closing "
}

function readNumber(src, pos) {
  let s = ''
  if (src[pos] === '-') {
    s = '-'
    pos++
  }
  while (pos < src.length && DIGIT.test(src[pos])) {
    s += src[pos]
    pos++
  }
  if (pos < src.length && src[pos] === '.') {
    s += '.'
    pos++
    while (pos < src.length && DIGIT.test(src[pos])) {
      s += src[pos]
      pos++
    }
  }
  return number(Number(s), pos)
}

function readSymbol(src, pos) {
  let name = ''
  while (pos < src.length && SYM_CHAR.test(src[pos])) {
    name += src[pos]
    pos++
  }
  if (name === 'nil') return symbol(null, pos, { literal: true })
  if (name === 'true') return symbol(true, pos, { literal: true })
  if (name === 'false') return symbol(false, pos, { literal: true })
  return symbol(name, pos)
}

function readKeyword(src, pos) {
  pos++ // skip :
  let name = ''
  while (pos < src.length && SYM_CHAR.test(src[pos])) {
    name += src[pos]
    pos++
  }
  return keyword(name, pos)
}

function readSequence(src, pos, close) {
  pos++ // skip opening bracket
  const items = []
  while (true) {
    pos = skip(src, pos)
    if (pos >= src.length) throw new ReaderError(`expected '${close}'`)
    if (src[pos] === close) return [items, pos + 1]
    const r = readExpr(src, pos)
    items.push(r)
    pos = r.pos
  }
}

function readList(src, pos) {
  const [items, end] = readSequence(src, pos, ')')
  return list(items, end)
}

function readVector(src, pos) {
  const [items, end] = readSequence(src, pos, ']')
  return vector(items, end)
}

function readMap(src, pos) {
  const [items, end] = readSequence(src, pos, '}')
  return map(items, end)
}

function readExpr(src, pos) {
  pos = skip(src, pos)
  if (pos >= src.length) return null

  const ch = src[pos]
  if (ch === "'") {
    const r = readExpr(src, pos + 1)
    return list([symbol('quote', pos), r], r.pos)
  }
  if (ch === '#' && pos + 1 < src.length && src[pos + 1] === "'") {
    const r = readExpr(src, pos + 2)
    return list([symbol('var', pos), r], r.pos)
  }
  if (ch === '(') return readList(src, pos)
  if (ch === '[') return readVector(src, pos)
  if (ch === '{') return readMap(src, pos)
  if (ch === '"') return readString(src, pos)
  if (ch === ':') return readKeyword(src, pos)
  if (DIGIT.test(ch)) return readNumber(src, pos)
  if (ch === '-' && pos + 1 < src.length && DIGIT.test(src[pos + 1])) return readNumber(src, pos)
  if (SYM_START.test(ch) || ch === '-') return readSymbol(src, pos)

  throw new ReaderError(`unexpected character: '${ch}' at position ${pos}`)
}

export function read(src) {
  return readExpr(src, 0) ?? null
}

export function readAll(src) {
  const exprs = []
  let pos = 0
  while (true) {
    pos = skip(src, pos)
    if (pos >= src.length) break
    const r = readExpr(src, pos)
    if (r == null) break
    exprs.push(r)
    pos = r.pos
  }
  return exprs
}
