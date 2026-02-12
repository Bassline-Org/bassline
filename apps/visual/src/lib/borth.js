// borth
// forth like
// but for bassline
const WS = ' \t\n\r'

const word = {
  _system: {},
  get system() {
    return word._system
  },
  ds: [],
  get height() {
    return this.ds.length
  },
  latest: undefined,
  _make(obj = {}) {
    const { name } = obj
    let w
    if (name && word.get(name)) {
      w = word.system[name]
    } else {
      w = Object.create(this)
      if (name) word._system[name] = w
    }
    Object.assign(w, obj)
    return w
  },
  get(name) {
    return this.system[name]
  },
  set(name, w) {
    if (!w.prototype.isPrototypeOf(word)) panic(`invalid word stored: ${w}`)
    const existing = word.get(name)
    if (existing) {
      Object.assign(existing, w)
    } else {
      this.system[name] = w
    }
  },
  run() {
    return this[word._system.mode.data]()
  },
  interp() {
    panic('no interp() method')
  },
  compile() {
    if (this.immediate) return this.interp()
    word.latest.data.push(this) ?? this.panic('failed to find latest')
  },
}

const variable = word._make({
  make(name, data = 0) {
    return this._make({ name, data })
  },
  interp() {
    word.ds.push(this.name)
  },
  get(name) {
    return word.get(name).data
  },
  set(name, value) {
    const w = word.get(name)
    if (w) {
      w.data = value
    } else {
      variable.make(name, value)
    }
  },
  update(name, fn, ifAbsent) {
    const w = word.get(name)
    if (w.data === undefined || w.data === null) return this.set(name, ifAbsent)
    return this.set(name, fn(w.data))
  },
})

const compiled = word._make({
  make(name) {
    const w = this._make({ name, data: [] })
    word.latest = w
    return w
  },
  interp() {
    for (const w of this.data) {
      w.run()
    }
  },
})

const lit = word._make({
  make(val) {
    if (val === undefined) panic('cannot define undefined lit')
    return this._make({ data: val })
  },
  interp() {
    word.ds.push(this.data)
  },
})

const fn = word._make({
  make(name, fn) {
    const arity = fn.length
    return this._make({ name, arity, fn })
  },
  interp() {
    if (word.height < this.arity) panic('stack underflow')
    const args = []
    for (let i = 0; i < this.arity; i++) {
      args.unshift(word.ds.pop())
    }
    let result = this.fn(...args) ?? []
    if (!Array.isArray(result)) result = [result]
    for (const res of result) {
      if (res === undefined || res === null) continue
      word.ds.push(res)
    }
  },
})

const ifn = fn._make({
  make(name, fn) {
    const arity = fn.length
    return this._make({ name, arity, fn, immediate: true })
  },
})

// stack manipulation
fn.make('dup', a => [a, structuredClone(a)])
fn.make('drop', a => [])
fn.make('swap', (a, b) => [b, a])
fn.make('rot', (a, b, c) => [b, c, a])
fn.make('over', (a, b) => [a, b, structuredClone(a)])
fn.make('.', a => (console.log(a), []))
// arithmetic
fn.make('+', (a, b) => [a + b])
fn.make('-', (a, b) => [a - b])
fn.make('*', (a, b) => [a * b])
fn.make('/', (a, b) => [a / b])
// vars
fn.make('variable', () => {
  const name = parse(WS)
  if (variable.get(name)) {
    return
  }
  variable.set(name, 0)
})
fn.make('@', name => [variable.get(name)])
fn.make('!', (name, val) => [variable.set(name, val)])
// parsing words
fn.make('parse', () => {
  const chars = parse(WS)
  return [parse(chars)]
})
fn.make("'", () => {
  const w = parse(WS)
  return [w]
})
fn.make('"', () => {
  const str = parse('"')
  return [str]
})
// compilation words
fn.make(':', () => {
  const name = parse(WS)
  variable.set('mode', 'compile')
  compiled.make(name)
  return []
})
ifn.make(';', () => (variable.set('mode', 'interp'), []))
fn.make('immediate', () => ((word.latest.immediate = true), []))
fn.make('regular', () => ((word.latest.immediate = undefined), []))
fn.make('dsp', () => console.log(word.ds))

variable.make('inputBuffer', '')
variable.make('mode', 'interp')

function parse(delims) {
  const input = variable.get('inputBuffer')
  let i = 0
  while (i < input.length && delims.includes(input[i])) i++
  const start = i
  while (i < input.length && !delims.includes(input[i])) i++
  const stop = i
  const parsed = input.slice(start, stop)
  variable.set('inputBuffer', input.slice(stop + 1))
  return stop > start ? parsed : undefined
}

function run(script) {
  variable.update('inputBuffer', old => old.concat(script))
  let w = parse(WS)
  while (w) {
    let entry = word.get(w)
    if (!entry) {
      const num = Number(w)
      if (isNaN(num)) {
        console.log(w)
        panic(`unknown word: ${w}`)
      }
      entry = lit.make(num)
    }
    entry.run()
    w = parse(WS)
  }
}

function panic(msg) {
  throw new Error(`panic: ${msg}`)
}

export { word, variable, compiled, fn, ifn, panic, run }
