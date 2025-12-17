// Token Types
export const TT = {
  ESC: Symbol('ESC'),
  STR: Symbol('STR'),
  CMD: Symbol('CMD'),
  VAR: Symbol('VAR'),
  SEP: Symbol('SEP'),
  EOL: Symbol('EOL'),
  EOF: Symbol('EOF'),
}

// Return Cases
export const RC = { BREAK: Symbol('BREAK'), CONTINUE: Symbol('CONTINUE'), RETURN: Symbol('RETURN') }

export function* tokenize(src) {
  let i = 0,
    type = TT.EOL,
    quoted = false

  // classification fns
  const ws = c => ' \t\r'.includes(c),
    eol = c => '\n;'.includes(c),
    word = c => /\w/.test(c),
    strEnd = c => '$['.includes(c) || (!quoted && ' \t\n\r;'.includes(c)) || (quoted && c === '"'),
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
      let deTTh = 1,
        brace = 0,
        start = ++i
      while (!done() && deTTh) {
        const c = peek()
        if (c === '\\') i++
        else if (c === open && !brace) deTTh++
        else if (c === close && !brace) deTTh--
        else if (c === '{') brace++
        else if (c === '}' && brace) brace--
        if (deTTh) i++
      }
      const text = src.slice(start, i++)
      return text
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
      const v = take(word)
      return v ? [TT.VAR, v] : [TT.STR, '$']
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

  const string = () => {
    let start = i
    while (!done() && !strEnd(peek())) {
      if (peek() === '\\') i++
      i++
    }

    if (quoted && peek() === '"') {
      quoted = false
      i++
      return [TT.STR, src.slice(start, i - 1)]
    }
    return i > start ? [TT.ESC, src.slice(start, i)] : null
  }

  while (!done()) {
    const tok = handlers[peek()]?.() ?? string()
    if (tok) {
      type = tok[0]
      yield { t: type, v: tok[1] }
    }
  }

  if (type !== TT.EOL) yield { t: TT.EOL }
  yield { t: TT.EOF }
}
