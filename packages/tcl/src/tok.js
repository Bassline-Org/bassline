// Token Types
export const TT = {
  // An escaped character / sequence: \n
  ESC: Symbol('ESC'),
  // A double quote delimited string: "hello $world"
  STR: Symbol('STR'),
  // A bracket delimited string: [command]
  CMD: Symbol('CMD'),
  // A variable reference: $foo
  VAR: Symbol('VAR'),
  // An array reference: $foo(index)
  ARR: Symbol('ARR'),
  // A horizontal seperator: space, tab
  SEP: Symbol('SEP'),
  // A command terminator: newline or semicolon
  EOL: Symbol('EOL'),
  // End of file
  EOF: Symbol('EOF'),
}

// Return Cases
export const RC = { BREAK: Symbol('BREAK'), CONTINUE: Symbol('CONTINUE'), RETURN: Symbol('RETURN') }

export function* tokenize(src) {
  // mutable state
  let i = 0,
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
      return src.slice(start, i++)
    }

  const handlers = {
    ' ': () => !quoted && (skip(ws), [TT.SEP]),
    '\t': () => !quoted && (skip(ws), [TT.SEP]),
    '\r': () => !quoted && (skip(ws), [TT.SEP]),
    '\n': () => !quoted && (skip(c => ws(c) || eol(c)), [TT.EOL]),
    ';': () => !quoted && (skip(c => ws(c) || eol(c)), [TT.EOL]),
    '[': () => [TT.CMD, balanced('[', ']')],
    $: () => {
      i++

      // ${name} braced form, NO SUBSTITUTION IN NAME!
      if (peek() === '{') {
        // unlike normal braces, they cannot contain nested braces
        const name = take(c => c !== '}')
        // Check for arrayName(index) form
        const arrMatch = name.match(/^([^(}]+)\(([^}]+)\)$/)
        if (arrMatch) {
          return [TT.ARR, { name: arrMatch[1], index: arrMatch[2], literal: true }]
        }
        return [TT.VAR, name]
      }

      const name = take(c => /[a-zA-Z0-9_]/.test(c) || c === ':')
      if (!name) return [TT.STR, '$']

      // $name(index), unbraced form for array access, substitution performed on index
      if (peek() === '(') {
        // The index also cannot contain nested parentheses
        const index = take(c => c !== ')')
        return [TT.ARR, { name, index, literal: false }]
      }

      // $name, unbraced form for scalar access, name will be substituted
      return [TT.VAR, name]
    },
    '{': () => (type === TT.SEP || type === TT.EOL) && [TT.STR, balanced('{', '}')],
    '"': () => {
      if (!(type === TT.SEP || type === TT.EOL) && quoted) return null
      quoted = true
      i++
      return null
    },
    '#': () => type === TT.EOL && (skip(c => c !== '\n'), null),
  }

  while (!done()) {
    const char = peek()

    if (!quoted && ws(char)) {
      skip(ws)
      yield { t: TT.SEP }
      continue
    }

    if (!quoted && eol(char)) {
      skip(c => ws(c) || eol(c))
      yield { t: TT.EOL }
      continue
    }

    // Try handler for current character
    const handler = handlers[char]
    if (handler) {
      const tok = handler()
      if (tok) {
        type = tok[0]
        yield { t: type, v: tok[1] }
      }
      continue
    }

    // Default: consume as string/word token
    i++
  }

  if (type !== TT.EOL) yield { t: TT.EOL }
  yield { t: TT.EOF }
}
