import { TT, RC, tokenize } from './tok.js'

export class Runtime {
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
      prev = TT.EOL
    this.result = ''

    for (const { t, v } of tokenize(src)) {
      let val = v

      switch (t) {
        case TT.ARR: {
          const { name, index, literal } = v
          if (literal) {
            const arr = this.get(name)
            const value = arr[index]
            if (value === undefined) throw new Error(`No such element '${index}' in array '${name}'`)
            val = value
          } else {
            const arr = this.get(name)
            const value = arr[this.run(index)]
            if (value === undefined) throw new Error(`No such element '${index}' in array '${name}'`)
            val = value
          }
          break
        }
        case TT.VAR:
          val = this.get(v)
          break

        case TT.CMD:
          val = this.run(v)
          break

        case TT.SEP:
          prev = t
          continue

        case TT.EOL:
        case TT.EOF:
          if (argv.length) {
            this.result = this.call(argv[0], argv.slice(1)) ?? this.result
          }
          argv = []
          prev = t
          continue
      }

      // Accumulate arguments
      if (prev === TT.SEP || prev === TT.EOL) {
        argv.push(val)
      } else {
        argv[argv.length - 1] += val
      }
      prev = t
    }
    return this.result
  }

  static withLibs(...libs) {
    return new Runtime({
      cmds: libs.reduce((acc, lib) => ({ ...acc, ...lib }), {}),
    })
  }
}
