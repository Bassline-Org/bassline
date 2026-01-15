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
}

const word = {
  make(rt, props) {
    const w = Object.create(this)
    if (rt) w.rt = rt
    w.attributes = {}
    Object.assign(w, props)
    if (rt && w.name) rt.dict[w.name] = rt.last = w
    return w
  },
  attributes: {},
  interp() {
    this.rt.ds.write(this)
  },
  compile() {
    this.immediate ? this.interp() : this.rt.target.write(this)
  },
  run() {
    this[this.rt.mode]()
  },
  read() {
    return this.data
  },
  write(v) {
    this.data = v
  },
}

// Specialized prototypes
const fn = derive(word, {
  interp() {
    const a = []
    for (let i = 0; i < this.fn.length; i++) a.unshift(this.rt.ds.read())
    const r = castArr(this.fn(...a))
    for (const v of r) if (v !== null) this.rt.ds.write(v)
  },
})

const lit = derive(word, {
  interp() {
    this.rt.ds.write(this.data)
  },
})

const seq = derive(word, {
  interp() {
    for (const w of this.body) {
      try {
        w.interp()
      } catch (e) {
        if (e.exit) {
          console.log('breaking')
          break
        }
        throw e
      }
    }
  },
  write(w) {
    this.body.push(w)
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

// Runtime
export function createRuntime() {
  const rt = {
    dict: {},
    last: null,
    mode: 'interp',
    input: buffer.create(),
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
      i.move(1)
      return i.data.slice(s, i.p - 1).join('')
    },

    next() {
      const t = this.parse(isWS)
      if (!t) return
      let w = this.dict[t]
      if (!w) {
        const num = Number(t)
        if (isNaN(num)) {
          throw Error(`unknown: ${t}`)
        }
        w = lit.make(this, { data: +t })
      }
      return w
    },

    run(src) {
      this.input.data = src.split('')
      this.input.p = 0
      let w = this.next()
      while (w !== undefined) {
        w.run()
        w = this.next()
      }
    },
  }

  const def = (n, f, imm) => fn.make(rt, { name: n, fn: f, immediate: imm })

  // Stream
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
  def(':', () => {
    rt.mode = 'compile'
    rt.pushTarget(seq.make(rt, { name: rt.parse(isWS), body: [] }))
  })
  def(
    ';',
    () => {
      rt.mode = 'interp'
      rt.popTarget()
    },
    true
  )
  def('next', () => {
    const w = rt.next()
    w.run()
  })
  def('immediate', () => {
    if (rt.last) rt.last.immediate = true
  })
  def('>attr', (key, val) => {
    if (rt.last) rt.last.attributes[key] = val
  })
  def('attr>', (name, attr) => {
    return [rt.dict[name].attributes[attr]]
  })
  // Parsing
  def('parse', delim => {
    if (typeof delim !== 'string') throw new Error('invalid parse')
    const str = rt.parse(c => delim.includes(c))
    return [str]
  })
  def('parse-word', () => {
    return [rt.parse(isWS)]
  })
  def(
    "'",
    () => {
      const str = rt.parse(isWS)
      if (rt.mode === 'compile') {
        rt.target.write(lit.make(rt, { data: str }))
      } else {
        rt.ds.write(str)
      }
    },
    true
  )
  def(
    '"',
    () => {
      const str = rt.parse(c => c === '"')
      if (rt.mode === 'compile') {
        rt.target.write(lit.make(rt, { data: str }))
      } else {
        rt.ds.write(str)
      }
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

export { word, fn, lit, seq, stream, buffer }
