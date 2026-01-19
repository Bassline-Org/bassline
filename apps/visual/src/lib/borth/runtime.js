// Runtime - the borth interpreter
import {
  Exit,
  panic,
  exit,
  castArr,
  isNil,
  Vocab,
  Stack,
  Word,
  Var,
  Fn,
  Wrapped,
  Compiled,
} from './primitives.js'
import { buffer } from './buffer.js'
import { builtinVocabs } from './vocabs/index.js'

const WS = ' \t\n\r'
const isWS = c => WS.includes(c)

export async function exec(rt, arr) {
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

class Runtime {
  current = null
  vocabs = []
  resolver = null
  last = null
  mode = 'interp'
  input = buffer()
  options = {
    'unbound-word-as-string': false,
  }
  _externalEmit = null
  _chrons = {}
  _execContext = null

  get target() {
    return this.targets.data[this.targets.length - 1]
  }

  allWords() {
    const result = {}
    for (const vocab of this.vocabs) {
      for (const [name, word] of vocab.words) {
        if (!result[name]) result[name] = word
      }
    }
    if (this.current && !this.vocabs.includes(this.current)) {
      for (const [name, word] of this.current.words) {
        result[name] = word
      }
    }
    return result
  }

  constructor() {
    this.targets = new Stack(new Stack())
    const core = new Vocab('core')
    this.vocabs.push(core)
    this.current = core
  }

  pushTarget(stack) {
    this.targets.write(stack ?? new Stack())
  }

  popTarget() {
    if (this.targets.length <= 1) {
      panic('cannot pop base target')
    }
    return this.targets.read()
  }

  async runFresh(word, ...stackArgs) {
    const prevMode = this.mode
    this.mode = 'interp'
    const s = new Stack()
    for (const arg of stackArgs) {
      s.write(arg)
    }
    this.pushTarget(s)
    try {
      await exec(this, word)
    } finally {
      this.popTarget()
      this.mode = prevMode
    }
  }

  async emitEvent(event, payload) {
    if (this._externalEmit) {
      await this._externalEmit(event, payload)
    }
  }

  startChron(name, intervalMs) {
    this.stopChron(name)
    const eventName = `chron:${name}`
    const timerId = setInterval(() => {
      this.emitEvent(eventName, { name, time: new Date().toISOString() })
    }, intervalMs)
    this._chrons[name] = { interval: intervalMs, timerId }
  }

  stopChron(name) {
    const chron = this._chrons[name]
    if (chron) {
      clearInterval(chron.timerId)
      delete this._chrons[name]
    }
  }

  stopAllChrons() {
    for (const name of Object.keys(this._chrons)) {
      this.stopChron(name)
    }
  }

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
    if (this.current) {
      const w = this.current.lookup(name, true)
      if (w) return w
    }
    for (let i = this.vocabs.length - 1; i >= 0; i--) {
      const w = this.vocabs[i].lookup(name, false)
      if (w) return w
    }
    const num = Number(name)
    if (!isNaN(num)) return num
    if (this.options['unbound-word-as-string']) {
      return name
    }
    panic(`unknown word: ${name}`)
  }

  next() {
    const t = this.parse(isWS)
    if (!t) return
    return this.find(t)
  }

  async run(src, context = null) {
    const prevContext = this._execContext
    this._execContext = context
    try {
      this.input.data = src.split('')
      this.input.p = 0
      let w = this.next()
      while (w !== undefined) {
        await exec(this, w)
        w = this.next()
      }
    } finally {
      this._execContext = prevContext
    }
  }

  def(name, fn, immediate) {
    new Fn(this, name, fn, immediate)
  }

  expose(bindings) {
    for (const [name, obj] of Object.entries(bindings)) {
      new Wrapped(this, obj, name)
    }
  }
}

function defineCore(rt) {
  const def = (name, fn, immediate) => rt.def(name, fn, immediate);
  // Streams
  def('.write', (s, v) => { s.write(v) })
  def('.read', s => [s.read()])
  def('target', () => rt.target)
  def('take', n => {
    const o = []
    for (let i = 0; i < n; i++) o.unshift(rt.target.read())
    return [o]
  })
  def('take-until', async (quote) => {
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
  def('drop', _a => { })
  def('swap', (a, b) => [b, a])
  def('rot', (a, b, c) => [b, c, a])
  def('over', (a, b) => [a, b, a])

  // Arithmetic
  def('+', (a, b) => a + b)
  def('-', (a, b) => a - b)
  def('*', (a, b) => a * b)
  def('/', (a, b) => a / b)
  def('mod', (a, b) => a % b)

  // Comparison
  def('>', (a, b) => a > b)
  def('>=', (a, b) => a >= b)
  def('<', (a, b) => a < b)
  def('<=', (a, b) => a <= b)
  def('=', (a, b) => a === b)
  def('0=', a => !a)

  // Booleans
  def('true', () => [true])
  def('false', () => [false])
  def('and', (a, b) => !!(a && b))
  def('or', (a, b) => !!(a || b))

  // Definitions
  def('variable', () => {
    if (!rt.current) panic('variable requires current vocabulary (use in: first)')
    new Var(rt, rt.parse(isWS))
  })

  def('[', () => {
    rt.mode = 'compile'
    rt.targets.write(new Compiled(rt))
  }, true)

  def(']', () => {
    if (rt.targets.length <= 2) {
      rt.mode = 'interp'
    }
    return [rt.targets.read().body.data]
  }, true)

  // Vocabulary
  def('in:', () => {
    const name = rt.parse(c => c === ';')?.trim()
    if (!name) panic('in: requires vocabulary name')
    if (name === 'core') panic('cannot modify core vocabulary')
    let vocab = rt.vocabs.find(v => v.name === name)
    if (!vocab) {
      vocab = new Vocab(name)
      rt.vocabs.push(vocab)
    }
    rt.current = vocab
  }, true)

  def('using:', async () => {
    const text = rt.parse(c => c === ';')?.trim()
    const names = text.split(/\s+/).filter(Boolean)
    if (!names.length) return

    for (const name of names) {
      let vocab = rt.vocabs.find(v => v.name === name)
      if (!vocab && rt.resolver) {
        vocab = await rt.resolver.resolve(name)
      }
      if (!vocab) panic(`unknown vocabulary: ${name}`)

      if (!rt.vocabs.includes(vocab)) {
        rt.vocabs.push(vocab)
      }
      if (rt.current) {
        rt.current.dependencies.add(vocab)
        vocab.dependents.add(rt.current)
      }
    }
  }, true)

  def(':', () => {
    if (!rt.current) panic(': requires current vocabulary (use in: first)')
    rt.mode = 'compile'
    rt.targets.write(new Compiled(rt, rt.parse(isWS)))
  })

  def(':_', () => {
    if (!rt.current) panic(':_ requires current vocabulary (use in: first)')
    rt.mode = 'compile'
    const word = new Compiled(rt, rt.parse(isWS))
    word.attributes.private = true
    rt.targets.write(word)
  })

  def(';', () => {
    rt.mode = 'interp'
    rt.last = rt.targets.read()
  }, true)

  def('do', async quote => await exec(rt, quote))
  def('next', async () => await exec(rt, rt.next()))
  def('immediate', () => {
    if (rt.last) rt.last.attributes.immediate = true
  })

  // Parsing
  def('(', () => { rt.parse(c => c === ')') }, true)

  def('syn:', () => {
    if (!rt.current) panic('syn: requires current vocabulary (use in: first)')
    rt.mode = 'compile'
    const name = rt.parse(isWS)
    const parseWord = new Compiled(rt, name)
    parseWord.attributes.immediate = true
    rt.targets.write(parseWord)
  }, true)
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

  // Control flow
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
    if (flag) await exec(rt, ifTrue)
  })

  def('unless', async (flag, ifFalse) => {
    if (!flag) await exec(rt, ifFalse)
  })

  def('times', async (quote, n) => {
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

  // Options
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

  def('clear', () => { rt.target.flush() })

  // Objects
  def('.get', (target, name) => [castArr(name).reduce((obj, key) => obj[key], target)])
  def('.set', (target, name, value) => { target[name] = value })
  def('keys', obj => [Object.keys(obj)])
  def('values', obj => [Object.values(obj)])

  // Strings
  def('join', (array, pattern) => array.join(pattern))
  def('split', (string, pattern) => [string.split(pattern)])
  def('startsWith', (string, pattern) => [string.startsWith(pattern)])
  def('endsWith', (string, pattern) => [string.endsWith(pattern)])
  def('includes', (string, pattern) => [string.includes(pattern)])
  def('trim', str => str.trim())
  def('rg', pattern => [new RegExp(pattern)])
  def('call', (target, name, arg) => [target[name].call(target, ...castArr(arg))])
  def('concat', (a, b) => [[...castArr(a), ...castArr(b)]])
  def("'", () => [rt.parse(isWS)], true)
  def('"', () => [rt.parse(c => c === '"')], true)
  def('""', () => [''], true)

  // Utilities
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
      o[n[i]] = d[i]
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

  def('now', () => [new Date().toISOString()])
  def('nil?', v => [isNil(v)])
  def('length', v => {
    if (Array.isArray(v)) return [v.length]
    if (typeof v === 'string') return [v.length]
    if (v && typeof v === 'object') return [Object.keys(v).length]
    return [-1]
  })
  def('not', v => !v)

  // Expose JS objects
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
}

export function createRuntime() {
  const rt = new Runtime()
  defineCore(rt)

  // Set up resolver with caching
  rt.resolver = {
    factories: { ...builtinVocabs },
    instances: {},
    register(name, factory) {
      this.factories[name] = factory
    },
    async resolve(name) {
      if (this.instances[name]) return this.instances[name]
      const factory = this.factories[name]
      if (!factory) return null
      const vocab = await factory(rt)
      this.instances[name] = vocab
      return vocab
    },
  }

  rt.current = null
  return rt
}

export async function runCard(rt, cards, cardId) {
  const card = cards.getCard(cardId)
  if (!card) throw new Error(`Card not found: ${cardId}`)
  const source = cards.getCardSource(cardId)
  const context = { cardId, version: card.head_version }
  await rt.run(source, context)
}

export async function runCardVersion(rt, cards, cardId, version) {
  const versionData = cards.getCardVersion(cardId, version)
  if (!versionData) throw new Error(`Version not found: ${cardId}@${version}`)
  const context = { cardId, version }
  await rt.run(versionData.source, context)
}
