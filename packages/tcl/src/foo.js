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

// const script = `

// set x foo
// set y bar

// set $x$y baz

// puts {foo $y}
// puts "foo $y"
// puts [string length $x$y]

// set greet [string repeat "ohhello " 500]
// set script {string repeat "hello" 500}

// puts [string concat a {*}{b c}]
// puts [string concat a {b c}]

// `
// foo.run(script)
