// Tcl expr - infix expression evaluator
// Implements proper operator precedence and lazy evaluation

import { parseList } from './libs/list.js'

// Token types for expr
const ET = {
  NUM: 'NUM', // Number literal
  STR: 'STR', // String literal
  VAR: 'VAR', // Variable reference $name
  CMD: 'CMD', // Command substitution [...]
  FUNC: 'FUNC', // Function name
  OP: 'OP', // Operator
  LPAREN: '(',
  RPAREN: ')',
  COMMA: ',',
  EOF: 'EOF',
}

// Tokenize an expression string
function* tokenizeExpr(src) {
  let i = 0
  const len = src.length

  const peek = () => src[i]
  const advance = () => src[i++]
  const isDigit = c => c >= '0' && c <= '9'
  const isAlpha = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
  const isAlnum = c => isAlpha(c) || isDigit(c)

  while (i < len) {
    const c = peek()

    // Skip whitespace
    if (/\s/.test(c)) {
      advance()
      continue
    }

    // Skip comments
    if (c === '#') {
      while (i < len && src[i] !== '\n') i++
      continue
    }

    // Numbers: integers and floats with various bases
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let num = ''

      // Check for base prefixes
      if (c === '0' && i + 1 < len) {
        const next = src[i + 1].toLowerCase()
        if (next === 'x') {
          // Hexadecimal
          num = advance() + advance() // 0x
          while (i < len && /[0-9a-fA-F_]/.test(peek())) {
            if (peek() !== '_') num += peek()
            advance()
          }
          yield { t: ET.NUM, v: parseInt(num, 16) }
          continue
        } else if (next === 'b') {
          // Binary
          num = advance() + advance() // 0b
          while (i < len && /[01_]/.test(peek())) {
            if (peek() !== '_') num += peek()
            advance()
          }
          yield { t: ET.NUM, v: parseInt(num.slice(2), 2) }
          continue
        } else if (next === 'o') {
          // Octal
          num = advance() + advance() // 0o
          while (i < len && /[0-7_]/.test(peek())) {
            if (peek() !== '_') num += peek()
            advance()
          }
          yield { t: ET.NUM, v: parseInt(num.slice(2), 8) }
          continue
        }
      }

      // Decimal integer or float
      while (i < len && (isDigit(peek()) || peek() === '_')) {
        if (peek() !== '_') num += peek()
        advance()
      }

      // Decimal point
      if (peek() === '.' && (isDigit(src[i + 1]) || !/[a-zA-Z]/.test(src[i + 1] || ''))) {
        num += advance()
        while (i < len && (isDigit(peek()) || peek() === '_')) {
          if (peek() !== '_') num += peek()
          advance()
        }
      }

      // Exponent
      if (peek() === 'e' || peek() === 'E') {
        num += advance()
        if (peek() === '+' || peek() === '-') num += advance()
        while (i < len && isDigit(peek())) num += advance()
      }

      yield { t: ET.NUM, v: parseFloat(num) }
      continue
    }

    // Special float values
    if (c === 'I' && src.slice(i, i + 3) === 'Inf') {
      i += 3
      yield { t: ET.NUM, v: Infinity }
      continue
    }
    if (c === 'N' && src.slice(i, i + 3) === 'NaN') {
      i += 3
      yield { t: ET.NUM, v: NaN }
      continue
    }

    // Variable reference
    if (c === '$') {
      advance()
      let name = ''
      if (peek() === '{') {
        // ${name}
        advance()
        while (i < len && peek() !== '}') name += advance()
        advance() // skip }
      } else {
        while (i < len && (isAlnum(peek()) || peek() === ':' || peek() === '/')) {
          name += advance()
        }
      }
      yield { t: ET.VAR, v: name }
      continue
    }

    // Command substitution
    if (c === '[') {
      advance()
      let depth = 1
      let cmd = ''
      while (i < len && depth > 0) {
        if (peek() === '[') depth++
        else if (peek() === ']') depth--
        if (depth > 0) cmd += advance()
        else advance()
      }
      yield { t: ET.CMD, v: cmd }
      continue
    }

    // String literals
    if (c === '"') {
      advance()
      let str = ''
      while (i < len && peek() !== '"') {
        if (peek() === '\\') {
          advance()
          const esc = advance()
          if (esc === 'n') str += '\n'
          else if (esc === 't') str += '\t'
          else if (esc === 'r') str += '\r'
          else str += esc
        } else {
          str += advance()
        }
      }
      advance() // skip closing "
      yield { t: ET.STR, v: str }
      continue
    }

    // Braced literals
    if (c === '{') {
      advance()
      let depth = 1
      let str = ''
      while (i < len && depth > 0) {
        if (peek() === '{') depth++
        else if (peek() === '}') depth--
        if (depth > 0) str += advance()
        else advance()
      }
      yield { t: ET.STR, v: str }
      continue
    }

    // Operators (multi-char first)
    const ops2 = ['**', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', 'eq', 'ne', 'lt', 'gt', 'le', 'ge', 'in', 'ni']
    const ops1 = ['+', '-', '*', '/', '%', '<', '>', '!', '~', '&', '^', '|', '?', ':']

    let matched = false
    for (const op of ops2) {
      if (src.slice(i, i + op.length) === op) {
        // Make sure word operators aren't part of identifier
        if (/[a-z]/.test(op[0])) {
          const after = src[i + op.length]
          if (after && isAlnum(after)) continue
        }
        i += op.length
        yield { t: ET.OP, v: op }
        matched = true
        break
      }
    }
    if (matched) continue

    for (const op of ops1) {
      if (c === op) {
        advance()
        yield { t: ET.OP, v: op }
        matched = true
        break
      }
    }
    if (matched) continue

    // Parentheses and comma
    if (c === '(') {
      advance()
      yield { t: ET.LPAREN }
      continue
    }
    if (c === ')') {
      advance()
      yield { t: ET.RPAREN }
      continue
    }
    if (c === ',') {
      advance()
      yield { t: ET.COMMA }
      continue
    }

    // Identifiers (function names, true/false)
    if (isAlpha(c)) {
      let name = ''
      while (i < len && isAlnum(peek())) name += advance()

      // Boolean literals
      if (name === 'true' || name === 'yes' || name === 'on') {
        yield { t: ET.NUM, v: 1 }
        continue
      }
      if (name === 'false' || name === 'no' || name === 'off') {
        yield { t: ET.NUM, v: 0 }
        continue
      }

      yield { t: ET.FUNC, v: name }
      continue
    }

    throw new Error(`expr: unexpected character '${c}'`)
  }

  yield { t: ET.EOF }
}

// Math functions
const mathFuncs = {
  // Trigonometric
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,

  // Hyperbolic
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,

  // Exponential & logarithmic
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  sqrt: Math.sqrt,
  pow: Math.pow,

  // Rounding
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  int: x => Math.trunc(x),
  wide: x => Math.trunc(x),
  entier: x => Math.trunc(x),
  double: x => Number(x),
  bool: x => (x ? 1 : 0),

  // Other
  abs: Math.abs,
  fmod: (x, y) => x % y,
  hypot: Math.hypot,
  isqrt: x => Math.floor(Math.sqrt(x)),
  max: Math.max,
  min: Math.min,
  rand: Math.random,
  srand: seed => {
    /* Not fully implementable in JS */ return seed
  },

  // Classification
  isfinite: x => (Number.isFinite(x) ? 1 : 0),
  isinf: x => (!Number.isFinite(x) && !Number.isNaN(x) ? 1 : 0),
  isnan: x => (Number.isNaN(x) ? 1 : 0),
  isnormal: x => (Number.isFinite(x) && x !== 0 ? 1 : 0),
  issubnormal: () => 0, // JS doesn't expose this
  isunordered: (x, y) => (Number.isNaN(x) || Number.isNaN(y) ? 1 : 0),
}

// Parser class with recursive descent
class ExprParser {
  constructor(src, rt) {
    this.tokens = [...tokenizeExpr(src)]
    this.pos = 0
    this.rt = rt
  }

  peek() {
    return this.tokens[this.pos] || { t: ET.EOF }
  }

  advance() {
    return this.tokens[this.pos++] || { t: ET.EOF }
  }

  expect(type) {
    const tok = this.advance()
    if (tok.t !== type) {
      throw new Error(`expr: expected ${type}, got ${tok.t}`)
    }
    return tok
  }

  // Get value of an operand
  getValue(tok) {
    switch (tok.t) {
      case ET.NUM:
        return tok.v
      case ET.STR:
        return tok.v
      case ET.VAR:
        return this.rt.getVar(tok.v)
      case ET.CMD:
        return this.rt.run(tok.v)
      default:
        throw new Error(`expr: unexpected token ${tok.t}`)
    }
  }

  // Try to convert to number, return original if not possible
  toNum(v) {
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isNaN(n) ? v : n
  }

  // Check if value is numeric
  isNumeric(v) {
    if (typeof v === 'number') return true
    return !Number.isNaN(Number(v))
  }

  // Parse expression (entry point)
  parse() {
    const result = this.parseTernary()
    if (this.peek().t !== ET.EOF) {
      throw new Error(`expr: unexpected token after expression`)
    }
    return result
  }

  // Ternary: expr ? expr : expr (right-to-left, lazy)
  parseTernary() {
    const cond = this.parseOr()
    if (this.peek().t === ET.OP && this.peek().v === '?') {
      this.advance() // consume ?
      const trueVal = this.parseTernary() // recursive for right-to-left
      this.expect(ET.OP) // expect :
      const falseVal = this.parseTernary()
      // Lazy evaluation: only evaluate the chosen branch
      return this.toNum(cond) ? trueVal : falseVal
    }
    return cond
  }

  // Logical OR: || (lazy)
  parseOr() {
    let left = this.parseAnd()
    while (this.peek().t === ET.OP && this.peek().v === '||') {
      this.advance()
      // Lazy: if left is true, don't evaluate right
      if (this.toNum(left)) {
        this.parseAnd() // consume but ignore
        left = 1
      } else {
        left = this.toNum(this.parseAnd()) ? 1 : 0
      }
    }
    return left
  }

  // Logical AND: && (lazy)
  parseAnd() {
    let left = this.parseBitOr()
    while (this.peek().t === ET.OP && this.peek().v === '&&') {
      this.advance()
      // Lazy: if left is false, don't evaluate right
      if (!this.toNum(left)) {
        this.parseBitOr() // consume but ignore
        left = 0
      } else {
        left = this.toNum(this.parseBitOr()) ? 1 : 0
      }
    }
    return left
  }

  // Bitwise OR: |
  parseBitOr() {
    let left = this.parseBitXor()
    while (this.peek().t === ET.OP && this.peek().v === '|') {
      this.advance()
      left = (this.toNum(left) | this.toNum(this.parseBitXor())) >>> 0
    }
    return left
  }

  // Bitwise XOR: ^
  parseBitXor() {
    let left = this.parseBitAnd()
    while (this.peek().t === ET.OP && this.peek().v === '^') {
      this.advance()
      left = (this.toNum(left) ^ this.toNum(this.parseBitAnd())) >>> 0
    }
    return left
  }

  // Bitwise AND: &
  parseBitAnd() {
    let left = this.parseListOp()
    while (this.peek().t === ET.OP && this.peek().v === '&') {
      this.advance()
      left = (this.toNum(left) & this.toNum(this.parseListOp())) >>> 0
    }
    return left
  }

  // List operators: in, ni
  parseListOp() {
    let left = this.parseStrEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'in' || this.peek().v === 'ni')) {
      const op = this.advance().v
      const right = this.parseStrEquality()
      const list = parseList(String(right))
      const found = list.includes(String(left))
      left = op === 'in' ? (found ? 1 : 0) : found ? 0 : 1
    }
    return left
  }

  // String equality: eq, ne
  parseStrEquality() {
    let left = this.parseNumEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'eq' || this.peek().v === 'ne')) {
      const op = this.advance().v
      const right = this.parseNumEquality()
      if (op === 'eq') left = String(left) === String(right) ? 1 : 0
      else left = String(left) !== String(right) ? 1 : 0
    }
    return left
  }

  // Numeric equality: ==, !=
  parseNumEquality() {
    let left = this.parseStrRelation()
    while (this.peek().t === ET.OP && (this.peek().v === '==' || this.peek().v === '!=')) {
      const op = this.advance().v
      const right = this.parseStrRelation()
      // Use numeric comparison if both are numeric, otherwise string
      if (this.isNumeric(left) && this.isNumeric(right)) {
        if (op === '==') left = this.toNum(left) === this.toNum(right) ? 1 : 0
        else left = this.toNum(left) !== this.toNum(right) ? 1 : 0
      } else {
        if (op === '==') left = String(left) === String(right) ? 1 : 0
        else left = String(left) !== String(right) ? 1 : 0
      }
    }
    return left
  }

  // String relational: lt, gt, le, ge
  parseStrRelation() {
    let left = this.parseNumRelation()
    while (this.peek().t === ET.OP && ['lt', 'gt', 'le', 'ge'].includes(this.peek().v)) {
      const op = this.advance().v
      const right = this.parseNumRelation()
      const cmp = String(left).localeCompare(String(right))
      if (op === 'lt') left = cmp < 0 ? 1 : 0
      else if (op === 'gt') left = cmp > 0 ? 1 : 0
      else if (op === 'le') left = cmp <= 0 ? 1 : 0
      else left = cmp >= 0 ? 1 : 0
    }
    return left
  }

  // Numeric relational: <, >, <=, >=
  parseNumRelation() {
    let left = this.parseShift()
    while (this.peek().t === ET.OP && ['<', '>', '<=', '>='].includes(this.peek().v)) {
      const op = this.advance().v
      const right = this.parseShift()
      const l = this.toNum(left),
        r = this.toNum(right)
      if (op === '<') left = l < r ? 1 : 0
      else if (op === '>') left = l > r ? 1 : 0
      else if (op === '<=') left = l <= r ? 1 : 0
      else left = l >= r ? 1 : 0
    }
    return left
  }

  // Shift: <<, >>
  parseShift() {
    let left = this.parseAdd()
    while (this.peek().t === ET.OP && (this.peek().v === '<<' || this.peek().v === '>>')) {
      const op = this.advance().v
      const right = this.parseAdd()
      if (op === '<<') left = this.toNum(left) << this.toNum(right)
      else left = this.toNum(left) >> this.toNum(right)
    }
    return left
  }

  // Additive: +, -
  parseAdd() {
    let left = this.parseMul()
    while (this.peek().t === ET.OP && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.advance().v
      const right = this.parseMul()
      if (op === '+') left = this.toNum(left) + this.toNum(right)
      else left = this.toNum(left) - this.toNum(right)
    }
    return left
  }

  // Multiplicative: *, /, %
  parseMul() {
    let left = this.parseExp()
    while (this.peek().t === ET.OP && ['*', '/', '%'].includes(this.peek().v)) {
      const op = this.advance().v
      const right = this.parseExp()
      const l = this.toNum(left),
        r = this.toNum(right)
      if (op === '*') left = l * r
      else if (op === '/') {
        // Tcl division: -57 / 10 = -6 (floor division for integers)
        if (Number.isInteger(l) && Number.isInteger(r)) {
          left = Math.floor(l / r)
        } else {
          left = l / r
        }
      } else {
        // Tcl modulus: consistent with floor division
        // -57 % 10 = 3 (so that -57 = -6 * 10 + 3)
        if (Number.isInteger(l) && Number.isInteger(r)) {
          left = l - Math.floor(l / r) * r
        } else {
          left = l % r
        }
      }
    }
    return left
  }

  // Exponentiation: ** (right-to-left)
  parseExp() {
    const left = this.parseUnary()
    if (this.peek().t === ET.OP && this.peek().v === '**') {
      this.advance()
      const right = this.parseExp() // right-to-left recursion
      return Math.pow(this.toNum(left), this.toNum(right))
    }
    return left
  }

  // Unary: -, +, !, ~
  parseUnary() {
    if (this.peek().t === ET.OP) {
      const op = this.peek().v
      if (op === '-' || op === '+' || op === '!' || op === '~') {
        this.advance()
        const val = this.parseUnary()
        if (op === '-') return -this.toNum(val)
        if (op === '+') return +this.toNum(val)
        if (op === '!') return this.toNum(val) ? 0 : 1
        if (op === '~') return ~this.toNum(val)
      }
    }
    return this.parsePrimary()
  }

  // Primary: number, string, variable, command, function call, parenthesized expr
  parsePrimary() {
    const tok = this.peek()

    // Parenthesized expression
    if (tok.t === ET.LPAREN) {
      this.advance()
      const result = this.parseTernary()
      this.expect(ET.RPAREN)
      return result
    }

    // Function call
    if (tok.t === ET.FUNC) {
      const name = this.advance().v
      if (this.peek().t !== ET.LPAREN) {
        throw new Error(`expr: expected ( after function name ${name}`)
      }
      this.advance() // consume (

      const args = []
      if (this.peek().t !== ET.RPAREN) {
        args.push(this.parseTernary())
        while (this.peek().t === ET.COMMA) {
          this.advance()
          args.push(this.parseTernary())
        }
      }
      this.expect(ET.RPAREN)

      const fn = mathFuncs[name]
      if (!fn) throw new Error(`expr: unknown math function "${name}"`)
      return fn(...args.map(a => this.toNum(a)))
    }

    // Literals and references
    if (tok.t === ET.NUM || tok.t === ET.STR || tok.t === ET.VAR || tok.t === ET.CMD) {
      this.advance()
      return this.getValue(tok)
    }

    throw new Error(`expr: unexpected token ${tok.t}`)
  }
}

// Main expr function
export function expr(src, rt) {
  const parser = new ExprParser(src, rt)
  const result = parser.parse()

  // Format result
  if (typeof result === 'number') {
    if (Number.isInteger(result)) {
      return String(result)
    }
    // Preserve decimal point for floats
    const str = String(result)
    if (!str.includes('.') && !str.includes('e') && !str.includes('E')) {
      return str + '.0'
    }
    return str
  }
  return String(result)
}

// Export for use in commands
export { mathFuncs }
