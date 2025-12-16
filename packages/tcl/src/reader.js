/**
 * @description Error when trying to read beyond the limits of a reader
 */
class EoiError extends Error {
  constructor() {
    super('Unexpected end of input')
  }
}

/**
 * @description A class representing a character based stream
 */
class CharStream {
  constructor() {
    this.chars = []
  }
  next() {
    if (this.done()) return
    return this.read(1)[0]
  }
  /**
   * @returns boolean
   */
  done() {
    return this.chars.length === 0
  }
  /**
   * @param {number | undefined} n how many characters to peek
   * @returns {string | undefined} The slice of the string
   */
  peek(n = 1) {
    if (n >= this.chars.length) return undefined
    if (n === 1) return this.chars[0]
    const slice = this.chars.slice(0, n)
    return slice.join('')
  }

  /**
   * @param {number} n how many characters to read
   * @throws {EoiError} If trying to read outside the bounds of chars
   * @returns {string}
   */
  read(n = 1) {
    if (n > this.chars.length) throw new EoiError()
    if (n === 1) return this.chars.shift()
    return this.chars.splice(0, n).join('')
  }
  /**
   * @param {String} str
   */
  write(str) {
    this.chars = this.chars.concat(str.split(''))
  }

  //==============
  // Helpers
  //==============

  takeWhile(pred) {
    let res = ''
    while (pred(this.peek()) && !this.done()) res += this.next()
    return res
  }
  takeUntil(pred) {
    return this.takeWhile((char) => !pred(char))
  }
  skipWhile(pred) {
    while (pred(this.peek()) && !this.done()) this.next()
  }
  skipUntil(pred) {
    this.skipWhile((char) => !pred(char))
  }
}

// ================
// Combinators
// ================
const all =
  (...preds) =>
  (x) =>
    preds.every((f) => f(x))
const any =
  (...preds) =>
  (x) =>
    preds.some((f) => f(x))
const none =
  (...preds) =>
  (x) =>
    preds.every((f) => !f(x))
const matches = (regex) => (char) => regex.test(char)
const not = (pred) => (x) => !pred(x)

export { CharStream, EoiError, all, any, none, matches, not }
