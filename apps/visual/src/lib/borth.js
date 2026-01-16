// borth - forth-like for bassline

const WS = ' \t\n\r'
const isWS = c => WS.includes(c)
const derive = (base, over) => Object.assign(Object.create(base), over)
const castArr = v => {
  if ((v ?? undefined) === undefined) return []
  if (!Array.isArray(v)) return [v]
  return v
}

const stack = {
  data: [],
  create() {
    const b = Object.create(this)
    b.data = []
    return b
  },
  read() {
    if (!this.data.length) throw new Error('stack underflow')
    return this.data.pop()
  },
  write(v) {
    this.data.push(v)
  },
}

const buffer = {
  data: [],
  create(ring) {
    const b = Object.create(this)
    b.data = []
    b.p = 0
    b.ring = ring
    return b
  },
  get size() {
    return this.data.length
  },
  read() {
    return this.data[this.p]
  },
  write(v) {
    this.insert(v)
  },
  move(n) {
    const s = this.size
    this.p = this.ring && s ? (((this.p + n) % s) + s) % s : Math.max(0, Math.min(this.p + n, s))
    return this.p
  },
  insert(...v) {
    this.data.splice(this.p + 1, 0, ...v)
    this.p += v.length
  },
  delete(n = 1) {
    this.data.splice(this.p, n)
  },
  leap(f, dir = 1) {
    for (let i = this.p + dir; dir > 0 ? i < this.size : i >= 0; i += dir)
      if (f(this.data[i])) {
        const s = this.p
        this.p = i
        return dir > 0 ? [s, i] : [i, s]
      }
    return []
  },
  skip(f, dir = 1) {
    while (this.p >= 0 && this.p < this.size && f(this.data[this.p])) this.p += dir
    return this.p
  },
  slice(start, end) {
    return this.data.slice(start, end ?? this.p).join('')
  },
}

const word = {
  make(rt, props) {
    const w = Object.create(this)
    const attrs = { ...(this.attributes ?? {}), ...(props.attributes ?? {}) }
    Object.assign(w, { ...props, rt, attributes: attrs })
    if (rt && w.attributes.name) {
      rt.dict[w.attributes.name] = w
      rt.last = w
    }
    return w
  },
  get name() {
    return this.attributes.name
  },
  get immediate() {
    return this.attributes.immediate
  },
  attributes: {},
  interp() {
    this.rt.ds.write(this)
  },
  compile() {
    this.immediate ? this.interp() : this.rt.target.write(this)
  },
  present() {},
  run() {
    const f = this[this.rt.mode]
    if (!f) {
      throw new Error(`unknown function for mode: ${this.rt.mode}`)
    }
    f.call(this)
  },
  read() {
    return this.data
  },
  write(v) {
    this.data = v
  },
}

const exec = (rt, arr) => {
  let quote = arr
  if (!Array.isArray(arr)) quote = [arr]
  for (const w of quote) {
    if (word.isPrototypeOf(w)) {
      w.run()
    } else {
      if (rt.mode === 'interp') {
        rt.ds.write(w)
      } else {
        rt.target.write(w)
      }
    }
  }
}

// Specialized prototypes
const fn = derive(word, {
  attributes: { type: 'fn' },
  interp() {
    const a = []
    for (let i = 0; i < this.fn.length; i++) a.unshift(this.rt.ds.read())
    const r = castArr(this.fn(...a))
    for (const v of r.filter(Boolean))
      if (this.rt.mode === 'interp') {
        this.rt.ds.write(v)
      } else {
        this.rt.target.write(v)
      }
  },
})

const seq = derive(word, {
  attributes: { type: 'compiled' },
  interp() {
    for (const w of this.body) {
      try {
        exec(this.rt, w)
      } catch (e) {
        if (e.exit) break
        throw e
      }
    }
  },
  read() {
    return this.body.pop()
  },
  write(...w) {
    this.body.push(...w)
  },
})

const stream = derive(word, {
  interp() {
    this.rt.ds.write(this.stream)
  },
  read() {
    return this.stream.read()
  },
  write(v) {
    this.stream.write(v)
  },
})

export function createRuntime() {
  const rt = {
    dict: {},
    last: null,
    mode: 'interp',
    input: buffer.create(),

    _listeners: {},
    on(event, fn) {
      let listeners = this._listeners[event]
      if (!listeners) {
        this._listeners[event] = []
      }
      listeners.push(fn)
      return () => this.off(event, fn)
    },
    off(event, fn) {
      const arr = this._listeners[event]
      if (arr) this._listeners[event] = arr.filter(f => f !== fn)
    },
    emit(event, data) {
      for (const fn of this._listeners[event] ?? []) fn(data)
    },

    ds: stack.create(),
    targets: [],
    get target() {
      return this.targets[this.targets.length - 1]
    },
    popTarget() {
      return this.targets.pop()
    },
    pushTarget(t) {
      return this.targets.push(t)
    },

    parse(d) {
      const i = this.input
      while (i.p < i.size && d(i.read())) i.move(1)
      if (i.p >= i.size) return
      const s = i.p
      while (i.p < i.size && !d(i.read())) i.move(1)
      const e = i.p
      if (i.p < i.size) i.move(1)
      return i.data.slice(s, e).join('')
    },

    next() {
      const t = this.parse(isWS)
      if (!t) return
      let w = this.dict[t]
      if (!w) {
        const num = Number(t)
        if (isNaN(num)) {
          if (this.mode === 'present') return this.next() // we skip unbound words in present mode
          throw Error(`unknown: ${t}`)
        }
        w = +t
      }
      return w
    },

    run(src) {
      this.input.data = src.split('')
      this.input.p = 0
      let w = this.next()
      while (w !== undefined) {
        exec(this, w)
        w = this.next()
      }
    },
  }

  const def = (n, f, imm) => fn.make(rt, { fn: f, attributes: { immediate: imm, name: n } })

  // "Stream" words
  def('.>', (v, s) => {
    s.write(v)
  })
  def('>.', s => [s.read()])
  def('..>', (_a, s) => {
    const a = castArr(_a)
    for (const v of a) s.write(v)
  })
  def('>..', (s, n) => {
    const o = []
    for (let i = 0; i < n; i++) o.push(s.read())
    return [o]
  })
  def('ds', () => rt.ds)
  def('take', n => {
    const o = []
    for (let i = 0; i < n; i++) o.unshift(rt.ds.read())
    return [o]
  })
  def('take-to', stop => {
    const o = []
    let val
    while (rt.ds.data.length && (val = rt.ds.read())) {
      if (val === stop) break
      o.unshift(val)
    }
    return [o]
  })
  def('splice', arr => castArr(arr))
  def('exit', () => {
    const e = new Error('exiting')
    e.exit = true
    throw e
  })
  def('err', msg => {
    throw new Error(`err: ${msg}`)
  })

  // Stack
  def('dup', a => [a, a])
  def('drop', _a => {})
  def('swap', (a, b) => [b, a])
  def('rot', (a, b, c) => [b, c, a])
  def('over', (a, b) => [a, b, a])
  def('.', a => console.log(a))

  // Arithmetic
  def('+', (a, b) => a + b)
  def('-', (a, b) => a - b)
  def('*', (a, b) => a * b)
  def('/', (a, b) => a / b)

  // comparison
  def('>', (a, b) => +(a > b))
  def('>=', (a, b) => +(a >= b))
  def('<', (a, b) => +(a < b))
  def('<=', (a, b) => +(a <= b))
  def('=', (a, b) => +(a === b))
  def('0=', a => +(a ?? 0))

  // Definitions
  def('variable', () => {
    word.make(rt, { name: rt.parse(isWS), data: 0 })
  })
  def('buffer', () => {
    stream.make(rt, { name: rt.parse(isWS), stream: buffer.create() })
  })
  def('stack', () => {
    stream.make(rt, { name: rt.parse(isWS), stream: stack.create() })
  })
  def(
    '[',
    () => {
      rt.mode = 'compile'
      rt.pushTarget(seq.make(rt, { body: [] }))
    },
    true
  )
  def(
    ']',
    () => {
      if (rt.targets.length <= 1) {
        rt.mode = 'interp'
      }
      const compiled = rt.popTarget()
      return [compiled.body]
    },
    true
  )
  def(':', () => {
    rt.mode = 'compile'
    rt.pushTarget(seq.make(rt, { attributes: { name: rt.parse(isWS) }, body: [] }))
  })
  def(
    ';',
    () => {
      rt.mode = 'interp'
      rt.popTarget()
    },
    true
  )
  def('do', w => {
    exec(rt, w)
  })
  def('next', () => {
    const w = rt.next()
    exec(rt, w)
  })
  def('immediate', () => {
    if (rt.last) rt.last.attributes.immediate = true
  })
  def('>attr', (key, val) => {
    if (rt.last) rt.last.attributes[key] = val
  })
  def('attr>', (name, attr) => {
    return [rt.dict[name].attributes[attr]]
  })
  // Parsing
  // for comments this is a very simple script, but i'm including this here for simplicitly sake
  def(
    '(',
    () => {
      rt.parse(c => c === ')')
    },
    true
  )
  def('parse', delim => {
    if (typeof delim !== 'string') throw new Error('invalid parse')
    const str = rt.parse(c => delim.includes(c))
    return [str]
  })
  def('parse-word', () => {
    return [rt.parse(isWS)]
  })
  def('if', (flag, ifTrue, ifFalse) => {
    if (flag) {
      exec(rt, ifTrue)
    } else {
      exec(rt, ifFalse)
    }
  })
  def('when', (flag, ifTrue) => {
    if (flag) {
      exec(rt, ifTrue)
    }
  })
  def('unless', (flag, ifFalse) => {
    if (!flag) {
      exec(rt, ifFalse)
    }
  })

  def('times', (n, quote) => {
    for (let i = 0; i < n; i++) {
      try {
        rt.ds.write(i)
        exec(rt, quote)
      } catch (e) {
        if (e.exit) {
          break
        } else {
          throw e
        }
      }
    }
  })

  def('quote', val => [[val]])

  def('map', (array, quote) => {
    return [
      array.map(v => {
        rt.ds.write(v)
        exec(rt, quote)
        return rt.ds.read()
      }),
    ]
  })
  def('filter', (array, quote) => {
    return [
      array.filter(v => {
        rt.ds.write(v)
        exec(rt, quote)
        return rt.ds.read()
      }),
    ]
  })
  def('fold', (array, quote, init) => {
    return [
      array.reduce((acc, curr) => {
        rt.ds.write(acc)
        rt.ds.write(curr)
        exec(rt, quote)
        return rt.ds.read()
      }, init),
    ]
  })
  def('each', (array, quote) => {
    for (const val of array) {
      try {
        rt.ds.write(val)
        exec(rt, quote)
      } catch (e) {
        if (e.exit) {
          break
        } else {
          throw e
        }
      }
    }
  })

  def('clear', () => {
    while (rt.ds.data.length) {
      rt.ds.read()
    }
  })

  def('nil', () => [undefined])

  def('console', () => [console])
  def('Math', () => [Math])
  def('Array', () => [Array])
  def('Object', () => [Object])

  def('find', name => rt.dict[name])
  def('get', (name, target) => [target[name]])
  def('set', (value, name, target) => {
    target[name] = value
  })
  def('call', (arg, name, target) => target[name].call(target, ...castArr(arg)))

  def('concat', (a, b) => {
    return [[...castArr(a), ...castArr(b)]]
  })

  def(
    "'",
    () => {
      const str = rt.parse(isWS)
      let word = rt.dict[str]
      if (!word) {
        const num = Number(str)
        if (!isNaN(num)) {
          word = num
        } else {
          word = str
        }
      }
      return [word]
    },
    true
  )
  def(
    '"',
    () => {
      const str = rt.parse(c => c === '"')
      return [str]
    },
    true
  )

  def('iota', n => {
    const o = []
    for (let i = 1; i <= n; i++) o.push(i)
    return [o]
  })

  return rt
}

export { word, fn, seq, stream, buffer }
