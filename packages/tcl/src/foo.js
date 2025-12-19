import { Runtime } from './parser.js'
import { std } from './libs/std.js'
import { string } from './libs/string.js'

export const foo = Runtime.withLibs(std, string)

class Stringable extends String {
  constructor(value, obj) {
    super(value)
    this.obj = obj
  }
  get obj() {
    return this._obj
  }
  set obj(obj) {
    this._obj = obj
  }
}

const script = `

set x {a b c d e f}
set y hello

puts [string concat hello $x]
puts $x(3)

`
foo.run(script)
