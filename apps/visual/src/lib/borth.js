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
  present() {},
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
  write(...w) {
    this.body.push(...w)
  },
  flushConditional() {
    return this.flushToFlag('branched')
  },
  flushToFlag(flag = 'branched') {
    if (this.rt.mode !== 'compile') {
      throw new Error('invalid conditional! Can only use conditionals during compilation')
    }
    const out = []
    let w
    let cond
    while ((w = this.body.pop())) {
      if (w[flag] && !w.complete) {
        cond = w
        this.body.push(w)
        break
      }
      out.unshift(w)
    }
    return [out, cond]
  },
})

const branched = derive(word, {
  branched: true, // so flushConditional() can find it
  interp() {
    // Read flag from stack (condition already evaluated before we run)
    const flag = this.rt.ds.read()
    // Pick branch based on truthy/falsy
    const branch = flag ? this.if : this.else
    if (branch) branch.run()
  },
})

const doloop = derive(word, {
  doloop: true,
  interp() {
    const index = this.rt.ds.read()
    const limit = this.rt.ds.read()
    // Push loop frame onto runtime's loop stack
    const frame = { limit, index, leave: false }
    this.rt.loopStack.push(frame)
    try {
      while (frame.index < frame.limit && !frame.leave) {
        this.body.run()
        frame.index++
      }
    } finally {
      this.rt.loopStack.pop()
    }
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
      ;(this._listeners[event] ||= []).push(fn)
      return () => this.off(event, fn)
    },
    off(event, fn) {
      const arr = this._listeners[event]
      if (arr) this._listeners[event] = arr.filter(f => f !== fn)
    },
    emit(event, data) {
      for (const fn of this._listeners[event] || []) fn(data)
    },

    // parts are for source tracking, tbd if we are going to keep this structure
    parts: {},
    currentPart: null,
    _lastCapturePos: 0,
    _presentGen: 0,

    addPart(name) {
      let p = this.parts[name]
      if (!p) {
        p = {
          name,
          data: '',
          index: Object.keys(this.parts).length,
          _gen: this._presentGen,
        }
        this.parts[name] = p
        this.emit('part:added', p)
      } else if (p._gen !== this._presentGen) {
        p.data = ''
        p._gen = this._presentGen
      }
      this.currentPart = p
      return p
    },

    updatePart(name, data) {
      const p = this.parts[name]
      if (p) {
        p.data = data
        this.emit('part:changed', p)
      }
    },

    toSource() {
      return Object.values(this.parts)
        .sort((a, b) => a.index - b.index)
        .map(p => (p.name === '_default' ? p.data : `part: ${p.name}\n${p.data}`))
        .join('\n')
    },

    ds: stack.create(),
    loopStack: [],
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
        w = lit.make(this, { data: +t })
      }
      return w
    },

    present(src) {
      this._presentGen++
      this.currentPart = null
      this._lastCapturePos = 0
      this.mode = 'present'
      this.run(src)
      this.mode = 'interp'
      this.emit('present:complete', { parts: this.parts })
    },

    run(src) {
      this.input.data = src.split('')
      this.input.p = 0
      let w = this.next()
      while (w !== undefined) {
        w.run()
        w = this.next()
      }
      if (this.mode === 'present' && this.currentPart) {
        this.currentPart.data += this.input.slice(this._lastCapturePos)
      }
    },
  }

  const def = (n, f, imm) => fn.make(rt, { name: n, fn: f, immediate: imm })

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

  // Part definition - structure extraction in present mode
  word.make(rt, {
    name: 'part:',
    immediate: true,
    interp() {
      rt.parse(isWS) // skip name, no-op in interp mode
    },
    present() {
      const input = rt.input
      const end = input.p
      // Back up over trailing whitespace, then over "part:" token
      input.move(-1)
      input.skip(isWS, -1)
      input.skip(c => !isWS(c), -1)
      // Handle edge case: if we backtracked past start, clamp to 0
      const tokenStart = Math.max(0, input.p)
      input.p = end

      // Only capture content if there's actually something between last capture and this token
      if (tokenStart > rt._lastCapturePos) {
        const prevRegion = input.slice(rt._lastCapturePos, tokenStart)
        if (!rt.currentPart) {
          if (!prevRegion.match(/^\s*$/)) {
            rt.addPart('_default')
            rt.currentPart.data = prevRegion
          }
        } else {
          rt.currentPart.data += prevRegion
        }
      }

      const name = rt.parse(isWS)
      rt._lastCapturePos = input.p
      rt.addPart(name)
    },
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
  // 10 20 > if foo bar else baz then ;
  // Condition is evaluated BEFORE if runs, flag left on stack
  def(
    'if',
    () => {
      const cond = branched.make(rt, {})
      cond.label = 'if'
      rt.target.write(cond)
    },
    true
  )
  def(
    'else',
    () => {
      const [branch, cond] = rt.target.flushConditional()
      cond[cond.label] = seq.make(rt, { body: branch })
      cond.label = 'else'
    },
    true
  )
  def(
    'then',
    () => {
      const [branch, cond] = rt.target.flushConditional()
      cond[cond.label] = seq.make(rt, { body: branch })
      cond.complete = true
    },
    true
  )

  // DO...LOOP
  // Usage: limit index DO ... LOOP
  // Example: 10 0 DO I . LOOP  ( prints 0 1 2 3 4 5 6 7 8 9 )
  def(
    'do',
    () => {
      const loop = doloop.make(rt, {})
      rt.target.write(loop)
    },
    true
  )
  def(
    'loop',
    () => {
      const [body, loop] = rt.target.flushToFlag('doloop')
      loop.body = seq.make(rt, { body })
      loop.complete = true
    },
    true
  )
  // I - push current loop index onto stack
  def('i', () => {
    const frame = rt.loopStack[rt.loopStack.length - 1]
    if (!frame) throw new Error('I used outside of loop')
    return [frame.index]
  })
  // J - push outer loop index onto stack (for nested loops)
  def('j', () => {
    const frame = rt.loopStack[rt.loopStack.length - 2]
    if (!frame) throw new Error('J used outside of nested loop')
    return [frame.index]
  })
  // LEAVE - exit the current loop early
  def('leave', () => {
    const frame = rt.loopStack[rt.loopStack.length - 1]
    if (!frame) throw new Error('LEAVE used outside of loop')
    frame.leave = true
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
