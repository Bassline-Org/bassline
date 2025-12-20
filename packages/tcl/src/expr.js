// Tcl expr - infix expression evaluator
// Implements proper operator precedence and lazy evaluation

import { parseList } from './libs/list.js'

// Token types for expr
const ET = {
  NUM: 'NUM', // Number literal (integer)
  FLOAT: 'FLOAT', // Number literal (explicitly float, e.g. 7.0)
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

      let isFloat = false

      // Decimal point
      if (peek() === '.' && (isDigit(src[i + 1]) || !/[a-zA-Z]/.test(src[i + 1] || ''))) {
        isFloat = true
        num += advance()
        while (i < len && (isDigit(peek()) || peek() === '_')) {
          if (peek() !== '_') num += peek()
          advance()
        }
      }

      // Exponent
      if (peek() === 'e' || peek() === 'E') {
        isFloat = true
        num += advance()
        if (peek() === '+' || peek() === '-') num += advance()
        while (i < len && isDigit(peek())) num += advance()
      }

      yield { t: isFloat ? ET.FLOAT : ET.NUM, v: parseFloat(num) }
      continue
    }

    // Special float values
    if (c === 'I' && src.slice(i, i + 3) === 'Inf') {
      i += 3
      yield { t: ET.FLOAT, v: Infinity }
      continue
    }
    if (c === 'N' && src.slice(i, i + 3) === 'NaN') {
      i += 3
      yield { t: ET.FLOAT, v: NaN }
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

  // Save current position
  savePos() {
    return this.pos
  }

  // Restore position
  restorePos(pos) {
    this.pos = pos
  }

  // Skip tokens until we're past a sub-expression at the current precedence level
  // This is used for lazy evaluation - we skip tokens without evaluating
  skipTernary() {
    this.skipOr()
    if (this.peek().t === ET.OP && this.peek().v === '?') {
      this.advance() // skip ?
      this.skipTernary() // skip true branch
      this.expect(ET.OP) // skip :
      this.skipTernary() // skip false branch
    }
  }

  skipOr() {
    this.skipAnd()
    while (this.peek().t === ET.OP && this.peek().v === '||') {
      this.advance()
      this.skipAnd()
    }
  }

  skipAnd() {
    this.skipBitOr()
    while (this.peek().t === ET.OP && this.peek().v === '&&') {
      this.advance()
      this.skipBitOr()
    }
  }

  skipBitOr() {
    this.skipBitXor()
    while (this.peek().t === ET.OP && this.peek().v === '|') {
      this.advance()
      this.skipBitXor()
    }
  }

  skipBitXor() {
    this.skipBitAnd()
    while (this.peek().t === ET.OP && this.peek().v === '^') {
      this.advance()
      this.skipBitAnd()
    }
  }

  skipBitAnd() {
    this.skipListOp()
    while (this.peek().t === ET.OP && this.peek().v === '&') {
      this.advance()
      this.skipListOp()
    }
  }

  skipListOp() {
    this.skipStrEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'in' || this.peek().v === 'ni')) {
      this.advance()
      this.skipStrEquality()
    }
  }

  skipStrEquality() {
    this.skipNumEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'eq' || this.peek().v === 'ne')) {
      this.advance()
      this.skipNumEquality()
    }
  }

  skipNumEquality() {
    this.skipStrRelation()
    while (this.peek().t === ET.OP && (this.peek().v === '==' || this.peek().v === '!=')) {
      this.advance()
      this.skipStrRelation()
    }
  }

  skipStrRelation() {
    this.skipNumRelation()
    while (this.peek().t === ET.OP && ['lt', 'gt', 'le', 'ge'].includes(this.peek().v)) {
      this.advance()
      this.skipNumRelation()
    }
  }

  skipNumRelation() {
    this.skipShift()
    while (this.peek().t === ET.OP && ['<', '>', '<=', '>='].includes(this.peek().v)) {
      this.advance()
      this.skipShift()
    }
  }

  skipShift() {
    this.skipAdd()
    while (this.peek().t === ET.OP && (this.peek().v === '<<' || this.peek().v === '>>')) {
      this.advance()
      this.skipAdd()
    }
  }

  skipAdd() {
    this.skipMul()
    while (this.peek().t === ET.OP && (this.peek().v === '+' || this.peek().v === '-')) {
      this.advance()
      this.skipMul()
    }
  }

  skipMul() {
    this.skipExp()
    while (this.peek().t === ET.OP && ['*', '/', '%'].includes(this.peek().v)) {
      this.advance()
      this.skipExp()
    }
  }

  skipExp() {
    this.skipUnary()
    if (this.peek().t === ET.OP && this.peek().v === '**') {
      this.advance()
      this.skipExp() // right-to-left
    }
  }

  skipUnary() {
    if (this.peek().t === ET.OP) {
      const op = this.peek().v
      if (op === '-' || op === '+' || op === '!' || op === '~') {
        this.advance()
        this.skipUnary()
        return
      }
    }
    this.skipPrimary()
  }

  skipPrimary() {
    const tok = this.peek()

    // Parenthesized expression
    if (tok.t === ET.LPAREN) {
      this.advance()
      this.skipTernary()
      this.expect(ET.RPAREN)
      return
    }

    // Function call
    if (tok.t === ET.FUNC) {
      this.advance()
      this.expect(ET.LPAREN)
      if (this.peek().t !== ET.RPAREN) {
        this.skipTernary()
        while (this.peek().t === ET.COMMA) {
          this.advance()
          this.skipTernary()
        }
      }
      this.expect(ET.RPAREN)
      return
    }

    // Literals and references - just skip the token
    if (tok.t === ET.NUM || tok.t === ET.FLOAT || tok.t === ET.STR || tok.t === ET.VAR || tok.t === ET.CMD) {
      this.advance()
      return
    }

    throw new Error(`expr: unexpected token ${tok.t} while skipping`)
  }

  // Get value of an operand (returns {v: value, isFloat: boolean})
  async getValue(tok) {
    switch (tok.t) {
      case ET.NUM:
        return { v: tok.v, isFloat: false }
      case ET.FLOAT:
        return { v: tok.v, isFloat: true }
      case ET.STR:
        return { v: tok.v, isFloat: false }
      case ET.VAR:
        return { v: this.rt.getVar(tok.v), isFloat: false }
      case ET.CMD:
        return { v: await this.rt.run(tok.v), isFloat: false }
      default:
        throw new Error(`expr: unexpected token ${tok.t}`)
    }
  }

  // Unwrap value (for backward compatibility in most operations)
  unwrap(val) {
    return typeof val === 'object' && val !== null && 'v' in val ? val.v : val
  }

  // Check if value is explicitly a float
  isExplicitFloat(val) {
    return typeof val === 'object' && val !== null && val.isFloat === true
  }

  // Try to convert to number, return original if not possible
  toNum(v) {
    const val = this.unwrap(v)
    if (typeof val === 'number') return val
    const n = Number(val)
    return Number.isNaN(n) ? val : n
  }

  // Check if value is numeric
  isNumeric(v) {
    const val = this.unwrap(v)
    if (typeof val === 'number') return true
    return !Number.isNaN(Number(val))
  }

  // Parse expression (entry point)
  async parse() {
    const result = await this.parseTernary()
    if (this.peek().t !== ET.EOF) {
      throw new Error(`expr: unexpected token after expression`)
    }
    return result
  }

  // Ternary: expr ? expr : expr (right-to-left, lazy)
  async parseTernary() {
    const cond = await this.parseOr()
    if (this.peek().t === ET.OP && this.peek().v === '?') {
      this.advance() // consume ?

      // Lazy evaluation: only evaluate the chosen branch
      if (this.toNum(cond)) {
        // Evaluate true branch
        const trueVal = await this.parseTernary()
        this.expect(ET.OP) // expect :
        // Skip false branch without evaluating
        this.skipTernary()
        return trueVal
      } else {
        // Skip true branch without evaluating
        this.skipTernary()
        this.expect(ET.OP) // expect :
        // Evaluate false branch
        const falseVal = await this.parseTernary()
        return falseVal
      }
    }
    return cond
  }

  // Logical OR: || (lazy)
  async parseOr() {
    let left = await this.parseAnd()
    while (this.peek().t === ET.OP && this.peek().v === '||') {
      this.advance()
      // Lazy: if left is true, don't evaluate right - skip it
      if (this.toNum(left)) {
        this.skipAnd() // skip without evaluating
        left = 1
      } else {
        left = this.toNum(await this.parseAnd()) ? 1 : 0
      }
    }
    return left
  }

  // Logical AND: && (lazy)
  async parseAnd() {
    let left = await this.parseBitOr()
    while (this.peek().t === ET.OP && this.peek().v === '&&') {
      this.advance()
      // Lazy: if left is false, don't evaluate right - skip it
      if (!this.toNum(left)) {
        this.skipBitOr() // skip without evaluating
        left = 0
      } else {
        left = this.toNum(await this.parseBitOr()) ? 1 : 0
      }
    }
    return left
  }

  // Bitwise OR: |
  async parseBitOr() {
    let left = await this.parseBitXor()
    while (this.peek().t === ET.OP && this.peek().v === '|') {
      this.advance()
      left = (this.toNum(left) | this.toNum(await this.parseBitXor())) >>> 0
    }
    return left
  }

  // Bitwise XOR: ^
  async parseBitXor() {
    let left = await this.parseBitAnd()
    while (this.peek().t === ET.OP && this.peek().v === '^') {
      this.advance()
      left = (this.toNum(left) ^ this.toNum(await this.parseBitAnd())) >>> 0
    }
    return left
  }

  // Bitwise AND: &
  async parseBitAnd() {
    let left = await this.parseListOp()
    while (this.peek().t === ET.OP && this.peek().v === '&') {
      this.advance()
      left = (this.toNum(left) & this.toNum(await this.parseListOp())) >>> 0
    }
    return left
  }

  // List operators: in, ni
  async parseListOp() {
    let left = await this.parseStrEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'in' || this.peek().v === 'ni')) {
      const op = this.advance().v
      const right = await this.parseStrEquality()
      const list = parseList(String(this.unwrap(right)))
      const found = list.includes(String(this.unwrap(left)))
      left = op === 'in' ? (found ? 1 : 0) : found ? 0 : 1
    }
    return left
  }

  // String equality: eq, ne
  async parseStrEquality() {
    let left = await this.parseNumEquality()
    while (this.peek().t === ET.OP && (this.peek().v === 'eq' || this.peek().v === 'ne')) {
      const op = this.advance().v
      const right = await this.parseNumEquality()
      const l = String(this.unwrap(left))
      const r = String(this.unwrap(right))
      if (op === 'eq') left = l === r ? 1 : 0
      else left = l !== r ? 1 : 0
    }
    return left
  }

  // Numeric equality: ==, !=
  async parseNumEquality() {
    let left = await this.parseStrRelation()
    while (this.peek().t === ET.OP && (this.peek().v === '==' || this.peek().v === '!=')) {
      const op = this.advance().v
      const right = await this.parseStrRelation()
      // Use numeric comparison if both are numeric, otherwise string
      if (this.isNumeric(left) && this.isNumeric(right)) {
        if (op === '==') left = this.toNum(left) === this.toNum(right) ? 1 : 0
        else left = this.toNum(left) !== this.toNum(right) ? 1 : 0
      } else {
        const l = String(this.unwrap(left))
        const r = String(this.unwrap(right))
        if (op === '==') left = l === r ? 1 : 0
        else left = l !== r ? 1 : 0
      }
    }
    return left
  }

  // String relational: lt, gt, le, ge
  async parseStrRelation() {
    let left = await this.parseNumRelation()
    while (this.peek().t === ET.OP && ['lt', 'gt', 'le', 'ge'].includes(this.peek().v)) {
      const op = this.advance().v
      const right = await this.parseNumRelation()
      const cmp = String(this.unwrap(left)).localeCompare(String(this.unwrap(right)))
      if (op === 'lt') left = cmp < 0 ? 1 : 0
      else if (op === 'gt') left = cmp > 0 ? 1 : 0
      else if (op === 'le') left = cmp <= 0 ? 1 : 0
      else left = cmp >= 0 ? 1 : 0
    }
    return left
  }

  // Numeric relational: <, >, <=, >=
  async parseNumRelation() {
    let left = await this.parseShift()
    while (this.peek().t === ET.OP && ['<', '>', '<=', '>='].includes(this.peek().v)) {
      const op = this.advance().v
      const right = await this.parseShift()
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
  async parseShift() {
    let left = await this.parseAdd()
    while (this.peek().t === ET.OP && (this.peek().v === '<<' || this.peek().v === '>>')) {
      const op = this.advance().v
      const right = await this.parseAdd()
      if (op === '<<') left = this.toNum(left) << this.toNum(right)
      else left = this.toNum(left) >> this.toNum(right)
    }
    return left
  }

  // Additive: +, -
  async parseAdd() {
    let left = await this.parseMul()
    while (this.peek().t === ET.OP && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.advance().v
      const right = await this.parseMul()
      if (op === '+') left = this.toNum(left) + this.toNum(right)
      else left = this.toNum(left) - this.toNum(right)
    }
    return left
  }

  // Multiplicative: *, /, %
  async parseMul() {
    let left = await this.parseExp()
    while (this.peek().t === ET.OP && ['*', '/', '%'].includes(this.peek().v)) {
      const op = this.advance().v
      const right = await this.parseExp()

      // Check if either operand is explicitly a float (e.g., 7.0)
      const leftIsFloat = this.isExplicitFloat(left)
      const rightIsFloat = this.isExplicitFloat(right)

      const l = this.toNum(left),
        r = this.toNum(right)

      if (op === '*') left = l * r
      else if (op === '/') {
        // Division by zero is an error
        if (r === 0) {
          throw new Error('divide by zero')
        }
        // Tcl division: use float division if either operand is explicitly float
        // Otherwise use floor division for integers
        if (leftIsFloat || rightIsFloat) {
          left = l / r
        } else if (Number.isInteger(l) && Number.isInteger(r)) {
          left = Math.floor(l / r)
        } else {
          left = l / r
        }
      } else {
        // Modulo by zero is also an error
        if (r === 0) {
          throw new Error('divide by zero')
        }
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
  async parseExp() {
    const left = await this.parseUnary()
    if (this.peek().t === ET.OP && this.peek().v === '**') {
      this.advance()
      const right = await this.parseExp() // right-to-left recursion
      return Math.pow(this.toNum(left), this.toNum(right))
    }
    return left
  }

  // Unary: -, +, !, ~
  async parseUnary() {
    if (this.peek().t === ET.OP) {
      const op = this.peek().v
      if (op === '-' || op === '+' || op === '!' || op === '~') {
        this.advance()
        const val = await this.parseUnary()
        if (op === '-') return -this.toNum(val)
        if (op === '+') return +this.toNum(val)
        if (op === '!') return this.toNum(val) ? 0 : 1
        if (op === '~') return ~this.toNum(val)
      }
    }
    return await this.parsePrimary()
  }

  // Primary: number, string, variable, command, function call, parenthesized expr
  async parsePrimary() {
    const tok = this.peek()

    // Parenthesized expression
    if (tok.t === ET.LPAREN) {
      this.advance()
      const result = await this.parseTernary()
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
        args.push(await this.parseTernary())
        while (this.peek().t === ET.COMMA) {
          this.advance()
          args.push(await this.parseTernary())
        }
      }
      this.expect(ET.RPAREN)

      const fn = mathFuncs[name]
      if (!fn) throw new Error(`expr: unknown math function "${name}"`)
      return fn(...args.map(a => this.toNum(a)))
    }

    // Literals and references
    if (tok.t === ET.NUM || tok.t === ET.FLOAT || tok.t === ET.STR || tok.t === ET.VAR || tok.t === ET.CMD) {
      this.advance()
      return await this.getValue(tok)
    }

    throw new Error(`expr: unexpected token ${tok.t}`)
  }
}

// Main expr function
export async function expr(src, rt) {
  const parser = new ExprParser(src, rt)
  const rawResult = await parser.parse()

  // Unwrap if it's a wrapped value
  const result = parser.unwrap(rawResult)

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
