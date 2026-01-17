// borth, issa concatenative language yo
const WS = ' \t\n\r'
const isWS = c => WS.includes(c)
const isNil = v => v === undefined || v === null
class Exit extends Error {}
const flush = array => array.splice(0, array.length)
function panic(msg) {
  throw new Error(`panic: ${msg}`)
}
function exit() {
  throw new Exit()
}
function castArr(v) {
  if (isNil(v)) return []
  if (!Array.isArray(v)) return [v]
  return v
}

class Stream {
  data = []
  get length() {
    return this.data.length
  }
  flush() {
    return flush(this.data)
  }
  read() {
    panic('not readable')
  }
  write(..._values) {
    panic('not writable')
  }
}

class Stack extends Stream {
  read() {
    if (!this.length) panic('stack underflow')
    return this.data.pop()
  }
  write(...values) {
    this.data.push(...values)
  }
}
async function exec(rt, arr) {
  let quote = arr
  if (!Array.isArray(arr)) quote = [arr]
  for (const w of quote) {
    try {
      if (w instanceof Word) {
        await w.run()
      } else if (w instanceof Promise) {
        rt.target.write(await w)
      } else {
        rt.target.write(w)
      }
    } catch (e) {
      if (e instanceof Exit) break
      throw e
    }
  }
}

class Word {
  attributes = {
    immediate: false,
  }
  accept(visitor) {
    return visitor.visitWord(this)
  }
  get name() {
    return this.attributes.name
  }
  get immediate() {
    return this.attributes.immediate
  }
  get target() {
    return this.rt.target
  }
  constructor(rt, attributes) {
    this.rt = rt
    this.attributes = { ...this.attributes, ...attributes }
    if (this.name && rt) {
      rt.dict[this.name] = this
      rt.last = this
    }
  }
  interp() {
    this.target.write(this)
  }
  compile() {
    return this.immediate ? this.interp() : this.target.write(this)
  }
  run() {
    const f = this[this.rt.mode]
    if (!f) panic(`unknown function for mode: ${this.rt.mode}`)
    return f.call(this)
  }
}

class Var extends Word {
  constructor(rt, name, value = 0) {
    super(rt, { name, type: 'variable' })
    this.data = value
  }
  accept(visitor) {
    return visitor.visitVar(this)
  }
  read() {
    return this.data
  }
  write(v) {
    this.data = v
  }
}

class Fn extends Word {
  constructor(rt, name, fn, immediate = false) {
    super(rt, { name, type: 'fn', immediate })
    this.fn = fn
  }
  accept(visitor) {
    return visitor.visitFn(this)
  }
  async interp() {
    const a = []
    for (let i = 0; i < this.fn.length; i++) a.unshift(this.target.read())
    let result = this.fn(...a)
    if (result instanceof Promise) {
      result = await result
    }
    const r = castArr(result).filter(v => !isNil(v))
    for (const v of r) {
      this.target.write(v)
    }
  }
}

class Wrapped extends Word {
  constructor(rt, wrapped, name) {
    super(rt, { type: 'wrapped', name })
    this.wrapped = wrapped
  }
  accept(visitor) {
    return visitor.visitWrapped(this)
  }
  interp() {
    return this.target.write(this.wrapped)
  }
}

class Compiled extends Word {
  constructor(rt, name) {
    super(rt, { name, type: 'compiled' })
    this.body = new Stack()
  }
  accept(visitor) {
    return visitor.visitCompiled(this)
  }
  read() {
    return this.body.read()
  }
  write(...values) {
    this.body.write(...values)
  }
  flush() {
    return this.body.flush()
  }
  interp() {
    const oldMode = this.rt.mode
    this.rt.mode = 'interp'
    const r = exec(this.rt, this.body.data)
    this.rt.mode = oldMode
    return r
  }
}

class Runtime {
  dict = {}
  last = null
  mode = 'interp'
  input = buffer()
  options = {
    'unbound-word-as-string': false,
  }
  _listeners = {}
  get target() {
    return this.targets.data[this.targets.length - 1]
  }
  constructor() {
    this.targets = new Stack()
    this.targets.write(new Stack())
  }
  // event stuffs
  on(event, func) {
    const listeners = this._listeners[event]
    if (!listeners) {
      this._listeners[event] = []
    }
    listeners.push(func)
    return () => this.off(event, func)
  }
  off(event, func) {
    const arr = this._listeners[event]
    if (arr) this._listeners[event] = arr.filter(f => f !== func)
  }
  emit(event, data) {
    for (const func of this._listeners[event] ?? []) func(data)
  }
  // parsing & execution
  parse(d) {
    const i = this.input
    while (i.p < i.size && d(i.read())) i.move(1)
    if (i.p >= i.size) return
    const s = i.p
    while (i.p < i.size && !d(i.read())) i.move(1)
    const e = i.p
    if (i.p < i.size) i.move(1)
    return i.data.slice(s, e).join('')
  }
  find(name) {
    const w = this.dict[name]
    if (w) return w
    const num = Number(name)
    if (!isNaN(num)) return num
    if (this.options['unbound-word-as-string']) {
      return name
    } else {
      panic(`unknown word: ${name}`)
    }
  }
  next() {
    const t = this.parse(isWS)
    if (!t) return
    return this.find(t)
  }
  async run(src) {
    this.input.data = src.split('')
    this.input.p = 0
    let w = this.next()
    while (w !== undefined) {
      await exec(this, w)
      w = this.next()
    }
  }
  // helpers for building out runtimes
  def(name, fn, immediate) {
    new Fn(this, name, fn, immediate)
  }
  expose(bindings) {
    for (const [name, obj] of Object.entries(bindings)) {
      new Wrapped(this, obj, name)
    }
  }
}

export function createRuntime() {
  const rt = new Runtime()
  const def = (n, f, imm) => rt.def(n, f, imm)
  // "Stream" words
  def('>>', (v, s) => {
    s.write(v)
  })
  def('<<', s => [s.read()])
  def('target', () => rt.target)
  def('take', n => {
    const o = []
    for (let i = 0; i < n; i++) o.unshift(rt.target.read())
    return [o]
  })
  def('take-until', async quote => {
    const o = []
    let val
    while (rt.target.data.length && (val = rt.target.read())) {
      rt.target.write(val)
      await exec(rt, quote)
      const v = rt.target.read()
      if (v) break
      o.unshift(val)
    }
    return [o]
  })
  def('splice', arr => castArr(arr))
  // Stack
  def('dup', a => [a, a])
  def('drop', _a => {})
  def('swap', (a, b) => [b, a])
  def('rot', (a, b, c) => [b, c, a])
  def('over', (a, b) => [a, b, a])
  def('.', a => console.log(a))
  def('.error', a => console.error(a))

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
  def('0=', a => (a ? 0 : 1))

  // Definitions
  def('variable', () => {
    new Var(rt, rt.parse(isWS))
  })
  def('buffer', () => {
    new Wrapped(rt, buffer(), rt.parse(isWS))
  })
  def('stack', () => {
    new Wrapped(rt, new Stack(), rt.parse(isWS))
  })
  def(
    '[',
    () => {
      rt.mode = 'compile'
      rt.targets.write(new Compiled(rt))
    },
    true
  )
  def(
    ']',
    () => {
      // [dataStack, compiled], so <= 2 means we are back to interp mode
      if (rt.targets.length <= 2) {
        rt.mode = 'interp'
      }
      return [rt.targets.read().body.data]
    },
    true
  )
  def(':', () => {
    rt.mode = 'compile'
    rt.targets.write(new Compiled(rt, rt.parse(isWS)))
  })
  def(
    ';',
    () => {
      rt.mode = 'interp'
      rt.last = rt.targets.read()
    },
    true
  )
  def('do', async quote => await exec(rt, quote))
  def('next', async () => await exec(rt, rt.next()))
  def('immediate', () => {
    if (rt.last) rt.last.attributes.immediate = true
  })
  def('>attr', (key, val) => {
    if (rt.last) {
      if(val === 'nil') {
        delete rt.last.attributes[key]
      } else {
        rt.last.attributes[key] = val
      }
      
    }
  })
  def('attr>', (name, attr) => {
    return [rt.dict[name].attributes[attr]]
  })
  def('words', () => {
    return [Object.values(rt.dict)]
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
  def(
    'syn:',
    () => {
      rt.mode = 'compile'
      const name = rt.parse(isWS)
      const parseWord = new Compiled(rt, name)
      parseWord.attributes.immediate = true
      rt.targets.write(parseWord)
    },
    true
  )
  def('parse', stop => {
    if (typeof stop !== 'string') panic(`parse-tokens, invalid stop ${stop}`)
    return [rt.parse(c => stop.includes(c))]
  })
  def('parse-tokens', stop => {
    if (typeof stop !== 'string') panic(`parse-tokens, invalid stop ${stop}`)
    const str = rt.parse(c => stop.includes(c))
    return [str.split(/\s+/).filter(Boolean)]
  })
  def('parse-word', () => [rt.parse(isWS)])
  // control flow / iteration
  def('exit', exit)
  def('err', panic)
  def('if', async (flag, ifTrue, ifFalse) => {
    if (flag) {
      await exec(rt, ifTrue)
    } else {
      await exec(rt, ifFalse)
    }
  })
  def('when', async (flag, ifTrue) => {
    if (flag) {
      await exec(rt, ifTrue)
    }
  })
  def('unless', async (flag, ifFalse) => {
    if (!flag) {
      await exec(rt, ifFalse)
    }
  })
  def('times', async (n, quote) => {
    for (let i = 0; i < n; i++) {
      try {
        rt.target.write(i)
        await exec(rt, quote)
      } catch (e) {
        if (e instanceof Exit) break
        throw e
      }
    }
  })
  def('quote', val => [[val]])
  def('map', async (array, quote) => {
    const results = []
    for (const v of array) {
      rt.target.write(v)
      await exec(rt, quote)
      results.push(rt.target.read())
    }
    return [results]
  })
  def('filter', async (array, quote) => {
    const results = []
    for (const v of array) {
      rt.target.write(v)
      await exec(rt, quote)
      if (rt.target.read()) results.push(v)
    }
    return [results]
  })
  def('fold', async (array, quote, init) => {
    let acc = init
    for (const curr of array) {
      rt.target.write(acc)
      rt.target.write(curr)
      await exec(rt, quote)
      acc = rt.target.read()
    }
    return [acc]
  })
  def('each', async (array, quote) => {
    for (const val of array) {
      try {
        rt.target.write(val)
        await exec(rt, quote)
      } catch (e) {
        if (e instanceof Exit) break
        throw e
      }
    }
  })
  def('opt:', () => {
    const key = rt.parse(isWS)
    const val = rt.parse(isWS)
    if (val === 'nil') {
      delete rt.options[key]
    } else {
      rt.options[key] = val
    }
  })
  def('opt', () => {
    const key = rt.parse(isWS)
    return [rt.options[key]]
  })
  def('clear', () => {
    rt.target.flush()
  })
  def('find', name => [rt.find(name)])
  def('get', (name, target) => [castArr(name).reduce((obj, key) => obj[key], target)])
  def('set', (value, name, target) => {
    target[name] = value
  })
  def('keys', obj => [Object.keys(obj)])
  def('values', obj => [Object.values(obj)])
  def('join', (array, pattern) => array.join(pattern))
  def('split', (string, pattern) => [string.split(pattern)])
  def('trim', str => str.trim())
  def('rg', pattern => [new RegExp(pattern)])
  def('call', (arg, name, target) => [target[name].call(target, ...castArr(arg))])
  def('concat', (a, b) => [[...castArr(a), ...castArr(b)]])
  def("'", () => [rt.parse(isWS)], true)
  def('"', () => [rt.parse(c => c === '"')], true)
  def('""', () => [''], true)
  def('index', (arr, indexArr) => {
    const a = castArr(arr)
    const index = castArr(indexArr)
    if (a.length < index.length) panic(`length mismatch: arr: ${a} index: ${index}`)
    const out = new Array(a.length)
    for (let i = 0; i < index.length; i++) {
      const idx = index[i]
      const val = a[idx]
      out[i] = val
    }
    return [out]
  })
  def('structure', (data, names) => {
    const d = castArr(data)
    const n = castArr(names)
    if (d.length < n.length) panic(`mismatched lengths: data: ${d} names: ${n}`)
    const o = {}
    for (let i = 0; i < n.length; i++) {
      const name = n[i]
      const data = d[i]
      o[name] = data
    }
    return [o]
  })
  def('extract', (obj, names) => {
    const o = []
    for (const name of castArr(names)) {
      o.push(obj[name])
    }
    return [o]
  })
  def('iota', n => {
    const o = []
    for (let i = 1; i <= n; i++) o.push(i)
    return [o]
  })

  rt.expose({
    console,
    Math,
    Array,
    Object,
    options: rt.options,
    convert: {
      number: v => [Number(v)],
      string: v => [String(v)],
      array: v => [castArr(v)],
    },
  })
  return rt
}

function buffer(ring) {
  return {
    data: [],
    ring,
    p: 0,
    get length() {
      return this.data.length
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
}

export { Word, Fn, Compiled, buffer, Wrapped, Stream, Stack }
