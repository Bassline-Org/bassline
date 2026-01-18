const isNil = v => v === undefined || v === null

class Exit extends Error { }

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

const flush = array => array.splice(0, array.length)

class Vocab {
  constructor(name) {
    this.name = name
    this.words = new Map()
    this.dependencies = new Set()
    this.dependents = new Set()
  }

  define(word) {
    const existing = this.words.get(word.name)
    word.vocab = this
    this.words.set(word.name, word)

    if (existing && existing.referencedBy.size > 0) {
      // Collect all words that need recompilation
      const toRecompile = new Set(existing.referencedBy)
      for (const dependent of toRecompile) {
        if (dependent.recompile) {
          dependent.recompile()
        }
      }
    }
  }

  lookup(name, includePrivate = false) {
    const word = this.words.get(name)
    if (!word) return null
    if (word.attributes.private && !includePrivate) return null
    return word
  }

  notify(changed, info, seen = new Set()) {
    if (seen.has(this)) return
    seen.add(this)
    for (const dep of this.dependents) {
      dep.notify(changed, info, seen)
    }
  }
}

class Stream {
  constructor(...data) {
    this.data = data ?? []
  }
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

class Word {
  attributes = {
    immediate: false,
    private: false,
  }
  vocab = null
  references = new Set()
  referencedBy = new Set()

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
      if (rt.current) {
        rt.current.define(this)
      }
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
    for (const v of values) {
      this._collectWords(v, word => {
        this.references.add(word)
        word.referencedBy.add(this)
      })
    }
    this.body.write(...values)
  }

  _collectWords(value, fn) {
    if (value instanceof Word) {
      fn(value)
    } else if (Array.isArray(value)) {
      for (const v of value) {
        this._collectWords(v, fn)
      }
    } else if (value && typeof value === 'object' && value.constructor === Object) {
      for (const v of Object.values(value)) {
        this._collectWords(v, fn)
      }
    }
  }
  flush() {
    return this.body.flush()
  }
  async interp() {
    const oldMode = this.rt.mode
    this.rt.mode = 'interp'
    const { exec } = await import('./runtime.js')
    const r = exec(this.rt, this.body.data)
    this.rt.mode = oldMode
    return r
  }

  recompile() {
    // Clear old references
    for (const ref of this.references) {
      ref.referencedBy.delete(this)
    }
    this.references.clear()

    // Recompile body
    const newBody = this.body.data.map(v => this._recompileValue(v))
    this.body.data = newBody

    // Rebuild references (recursively for nested structures)
    for (const v of newBody) {
      this._collectWords(v, word => {
        this.references.add(word)
        word.referencedBy.add(this)
      })
    }
  }

  _recompileValue(value) {
    if (value instanceof Word) {
      return this.rt.find(value.name)
    }
    if (Array.isArray(value)) {
      return value.map(v => this._recompileValue(v))
    }
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = this._recompileValue(v)
      }
      return result
    }
    return value
  }
}

export {
  Exit,
  panic,
  exit,
  castArr,
  isNil,
  flush,
  Vocab,
  Stream,
  Stack,
  Word,
  Var,
  Fn,
  Wrapped,
  Compiled,
}
