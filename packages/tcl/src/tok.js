// Token Types
export const TT = {
  STR: Symbol('STR'), // Bare word or literal part of quoted string
  BRC: Symbol('BRC'), // Braced string {literal} - NO substitution
  CMD: Symbol('CMD'), // Command substitution [...]
  VAR: Symbol('VAR'), // Variable $name
  ARR: Symbol('ARR'), // Array $name(index)
  ESC: Symbol('ESC'), // Backslash escape \x
  SEP: Symbol('SEP'), // Word separator
  EOL: Symbol('EOL'), // Command terminator
  EOF: Symbol('EOF'), // End of input
}

// Return Cases
export const RC = { BREAK: Symbol('BREAK'), CONTINUE: Symbol('CONTINUE'), RETURN: Symbol('RETURN') }

export function* tokenize(src) {
  // mutable state
  let i = 0,
    start = 0,
    type = TT.EOL,
    quoted = false

  // classification fns
  const ws = c => ' \t'.includes(c),
    eol = c => '\n;'.includes(c),
    // stream manipulation functions
    peek = () => src[i],
    done = () => i >= src.length,
    skip = pred => {
      while (!done() && pred(peek())) i++
    },
    take = pred => {
      const s = i
      skip(pred)
      return src.slice(s, i)
    },
    balanced = (open, close) => {
      let depth = 1,
        start = ++i
      while (!done() && depth > 0) {
        const c = peek()
        if (c === '\\') i++
        else if (c === open) depth++
        else if (c === close) depth--
        i++
      }
      if (depth > 0) throw new Error(`Unbalanced delimiter: ${open}, expected ${close} starting at ${start}`)
      return src.slice(start, i - 1)
    }

  // Check if char is a word-break (ends a bare word)
  const isWordBreak = c => ws(c) || eol(c) || '[]$"\\'.includes(c)

  // Flush accumulated quoted string content before a substitution
  const flushQuoted = function* () {
    if (quoted && i > start) {
      yield { t: TT.STR, v: src.slice(start, i) }
    }
  }

  while (!done()) {
    const char = peek()

    if (!quoted && ws(char)) {
      skip(ws)
      type = TT.SEP
      start = i
      yield { t: type }
      continue
    }

    if (!quoted && eol(char)) {
      skip(c => ws(c) || eol(c))
      type = TT.EOL
      start = i
      yield { t: type }
      continue
    }

    // Rule 10: Comments only at start of command
    if (!quoted && char === '#' && type === TT.EOL) {
      skip(c => c !== '\n')
      continue
    }

    if (char === '[') {
      yield* flushQuoted()
      type = TT.CMD
      yield { t: TT.CMD, v: balanced('[', ']') }
      start = i // update start for next quoted segment
      continue
    }

    if (char === '{') {
      if (!(type === TT.SEP || type === TT.EOL)) {
        i++
        continue
      }
      type = TT.BRC
      yield { t: TT.BRC, v: balanced('{', '}') }
      continue
    }

    if (char === '"') {
      if (quoted) {
        type = TT.STR
        yield { t: type, v: src.slice(start, i) }
        quoted = false
      } else {
        quoted = true
        start = i + 1 // start after the opening quote
      }
      i++
      continue
    }

    if (char === '$') {
      yield* flushQuoted()
      i++

      // ${name} braced form, NO SUBSTITUTION IN NAME!
      if (peek() === '{') {
        i++ // skip {
        // unlike normal braces, they cannot contain nested braces
        const name = take(c => c !== '}')
        i++ // skip }
        // Check for arrayName(index) form
        const arrMatch = name.match(/^([^(}]+)\(([^}]+)\)$/)
        if (arrMatch) {
          type = TT.ARR
          yield { t: TT.ARR, v: { name: arrMatch[1], index: arrMatch[2], literal: true } }
          start = i
          continue
        }
        type = TT.VAR
        yield { t: TT.VAR, v: name }
        start = i
        continue
      }

      const name = take(c => /[a-zA-Z0-9_]/.test(c) || c === ':' || c === '/')
      if (!name) {
        type = TT.STR
        yield { t: TT.STR, v: '$' }
        start = i
        continue
      }

      // $name(index), unbraced form for array access, substitution performed on index
      if (peek() === '(') {
        i++ // skip (
        // The index also cannot contain nested parentheses
        const index = take(c => c !== ')')
        i++ // skip )
        type = TT.ARR
        yield { t: TT.ARR, v: { name, index, literal: false } }
        start = i
        continue
      }

      // $name, unbraced form for scalar access, name will be substituted
      type = TT.VAR
      yield { t: TT.VAR, v: name }
      start = i
      continue
    }

    // Rule 9: Backslash substitution
    if (char === '\\') {
      yield* flushQuoted()
      type = TT.ESC
      yield { t: TT.ESC, v: src.slice(i, i + 2) }
      i += 2
      start = i
      continue
    }

    // Default: consume bare word token
    if (!quoted) {
      const wordStart = i
      while (!done() && !isWordBreak(peek())) i++
      if (i > wordStart) {
        type = TT.STR
        yield { t: TT.STR, v: src.slice(wordStart, i) }
      }
      continue
    }

    // Inside quoted string: accumulate chars
    i++
  }

  if (type !== TT.EOL) yield { t: TT.EOL }
  yield { t: TT.EOF }
}
