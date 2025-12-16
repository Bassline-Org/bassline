const PT = { ESC: 'ESC', STR: 'STR', CMD: 'CMD', VAR: 'VAR', SEP: 'SEP', EOL: 'EOL', EOF: 'EOF' }

const BREAK = Symbol('break'),
  CONTINUE = Symbol('continue'),
  RETURN = Symbol('return')

const err = msg => {
  throw new Error(msg)
}

function* tokenize(src) {
  let i = 0,
    type = PT.EOL,
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
      let depth = 1,
        brace = 0,
        start = ++i
      while (!done() && depth) {
        const c = peek()
        if (c === '\\') i++
        else if (c === open && !brace) depth++
        else if (c === close && !brace) depth--
        else if (c === '{') brace++
        else if (c === '}' && brace) brace--
        if (depth) i++
      }
      const text = src.slice(start, i++)
      return text
    }

  const handlers = {
    ' ': () => !quoted && (skip(ws), [PT.SEP]),
    '\t': () => !quoted && (skip(ws), [PT.SEP]),
    '\r': () => !quoted && (skip(ws), [PT.SEP]),
    '\n': () => !quoted && (skip(c => ws(c) || eol(c)), [PT.EOL]),
    ';': () => !quoted && (skip(c => ws(c) || eol(c)), [PT.EOL]),
    '[': () => [PT.CMD, balanced('[', ']')],
    $: () => {
      i++
      const v = take(word)
      return v ? [PT.VAR, v] : [PT.STR, '$']
    },
    '{': () => (type === PT.SEP || type === PT.EOL) && [PT.STR, balanced('{', '}')],
    '"': () => (type === PT.SEP || type === PT.EOL) && !quoted && ((quoted = true), i++, null),
    '#': () => type === PT.EOL && (skip(c => c !== '\n'), null),
  }

  const string = () => {
    const start = i
    while (!done() && !strEnd(peek())) {
      if (peek() === '\\') i++
      i++
    }
    if (quoted && peek() === '"') {
      quoted = false
      i++
    }
    return i > start ? [PT.ESC, src.slice(start, i)] : null
  }

  while (!done()) {
    const tok = handlers[peek()]?.() ?? string()
    if (tok) {
      type = tok[0]
      yield { t: type, v: tok[1] }
    }
  }

  if (type !== PT.EOL) yield { t: PT.EOL }
  yield { t: PT.EOF }
}

class Runtime {
  constructor({ parent = null, cmds = {}, vars = {} } = {}) {
    this.parent = parent
    this.cmds = parent ? Object.create(parent.cmds) : { ...cmds }
    this.vars = parent ? Object.create(parent.vars) : { ...vars }
    this.result = ''
  }

  scope() {
    return new Runtime({ parent: this })
  }

  get(name) {
    if (name in this.vars) return this.vars[name]
    throw new Error(`No such var '${name}'`)
  }

  set(name, value) {
    this.vars[name] = value
    return value
  }

  register(name, fn) {
    this.cmds[name] = fn
    return this
  }

  call(name, args) {
    const fn = this.cmds[name]
    if (!fn) throw new Error(`No such cmd '${name}'`)
    return fn(args, this)
  }

  run(src) {
    let argv = [],
      prev = PT.EOL
    this.result = ''

    for (const { t, v } of tokenize(src)) {
      let val = v

      switch (t) {
        case PT.VAR:
          val = this.get(v)
          break

        case PT.CMD:
          val = this.run(v)
          break

        case PT.SEP:
          prev = t
          continue

        case PT.EOL:
        case PT.EOF:
          if (argv.length) {
            this.result = this.call(argv[0], argv.slice(1)) ?? this.result
          }
          argv = []
          prev = t
          continue
      }

      // Accumulate arguments
      if (prev === PT.SEP || prev === PT.EOL) {
        argv.push(val)
      } else {
        argv[argv.length - 1] += val
      }
      prev = t
    }
    return this.result
  }
}

// Standard library - completely decoupled
const stdlib = {
  set: ([name, value], interp) => (value === undefined ? interp.get(name) : interp.set(name, value)),

  puts: ([msg]) => (console.log(msg), msg),

  if: ([cond, then, , elseBranch], interp) => interp.run(+interp.run(cond) ? then : (elseBranch ?? '')),

  while: ([cond, body], interp) => {
    let result = ''
    while (+interp.run(cond)) {
      try {
        result = interp.run(body)
      } catch (e) {
        if (e === BREAK) break
        if (e !== CONTINUE) throw e
      }
    }
    return result
  },

  proc: ([name, params, body], interp) => {
    const paramList = params.split(/\s+/).filter(Boolean)
    interp.register(name, (args, caller) => {
      const local = caller.scope()
      paramList.forEach((p, i) => local.set(p, args[i]))
      try {
        return local.run(body)
      } catch (e) {
        if (e !== RETURN) throw e
        return local.result
      }
    })
  },

  return: ([val], interp) => {
    interp.result = val ?? ''
    throw RETURN
  },
  break: () => {
    throw BREAK
  },
  continue: () => {
    throw CONTINUE
  },

  // Shitty Math ops
  ...Object.fromEntries(
    ['+', '-', '*', '/', '%', '>', '<', '>=', '<=', '==', '!='].map(op => [
      op,
      ([a, b]) => {
        const [x, y] = [+a, +b]
        const result = {
          '+': x + y,
          '-': x - y,
          '*': x * y,
          '/': (x / y) | 0,
          '%': x % y,
          '>': x > y,
          '<': x < y,
          '>=': x >= y,
          '<=': x <= y,
          '==': x === y,
          '!=': x !== y,
        }[op]
        return typeof result === 'boolean' ? (result ? 1 : 0) : result
      },
    ])
  ),
}

function runtime(opts = {}) {
  const interp = new Runtime({
    vars: opts.vars,
    cmds: { ...stdlib, ...opts.cmds },
  })
  return interp
}

const interp = runtime()

interp.run(`
    proc fib {n} {
      if {<= $n 1} { return $n }
      return [+ [fib [- $n 1]] [fib [- $n 2]]]
    }
  
    set i 0
    while {< $i 15} {
      puts [fib $i]
      set i [+ $i 1]
    }
  `)
