const WHITESPACE = /\s/
const DIGIT = /\d/
const SYM_START = /[a-zA-Z_+*/=<>!?.]/
const SYM_CHAR = /[a-zA-Z0-9_+*/=<>!?.-]/

export function sym(name) {
  return { sym: name }
}
export function isSym(x) {
  return x !== null && typeof x === 'object' && 'sym' in x
}

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
  return { val, pos: pos + 1 } // skip closing "
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
  return { val: Number(s), pos }
}

function readSymbol(src, pos) {
  let name = ''
  while (pos < src.length && SYM_CHAR.test(src[pos])) {
    name += src[pos]
    pos++
  }
  if (name === 'nil') return { val: null, pos }
  if (name === 'true') return { val: true, pos }
  if (name === 'false') return { val: false, pos }
  return { val: sym(name), pos }
}

function readKeyword(src, pos) {
  pos++ // skip :
  let name = ''
  while (pos < src.length && SYM_CHAR.test(src[pos])) {
    name += src[pos]
    pos++
  }
  return { val: name, pos }
}

function readSequence(src, pos, close) {
  pos++ // skip opening bracket
  const items = []
  while (true) {
    pos = skip(src, pos)
    if (pos >= src.length) throw new Error(`expected '${close}'`)
    if (src[pos] === close) return { items, pos: pos + 1 }
    const r = readExpr(src, pos)
    items.push(r.val)
    pos = r.pos
  }
}

function readList(src, pos) {
  const { items, pos: end } = readSequence(src, pos, ')')
  return { val: { list: items }, pos: end }
}

function readVector(src, pos) {
  const { items, pos: end } = readSequence(src, pos, ']')
  return { val: items, pos: end }
}

function readMap(src, pos) {
  const { items, pos: end } = readSequence(src, pos, '}')
  const obj = {}
  for (let i = 0; i < items.length; i += 2) {
    const key = items[i]
    const val = items[i + 1]
    if (typeof key !== 'string') throw new ReaderError(`map key must be a keyword, got: ${JSON.stringify(key)}`)
    obj[key] = val
  }
  return { val: obj, pos: end }
}

function readExpr(src, pos) {
  pos = skip(src, pos)
  if (pos >= src.length) return null

  const ch = src[pos]
  if (ch === "'") {
    const r = readExpr(src, pos + 1)
    return { val: { list: [sym('quote'), r.val] }, pos: r.pos }
  }
  if (ch === '#' && pos + 1 < src.length && src[pos + 1] === "'") {
    const r = readExpr(src, pos + 2)
    return { val: { list: [sym('var'), r.val] }, pos: r.pos }
  }
  if (ch === '@') {
    const r = readExpr(src, pos + 1)
    return { val: { list: [sym('deref'), r.val] }, pos: r.pos }
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
  const r = readExpr(src, 0)
  return r ? r.val : null
}

export function readAll(src) {
  const exprs = []
  let pos = 0
  while (true) {
    pos = skip(src, pos)
    if (pos >= src.length) break
    const r = readExpr(src, pos)
    if (!r) break
    exprs.push(r.val)
    pos = r.pos
  }
  return exprs
}
