export class TclToken {
  constructor(str) {
    this._str = str
  }
  get str() {
    return this._str
  }
  set str(s) {
    this._str = s
  }
  sub(_runtime) {
    return this.str
  }
}

// Words can contain multiple sub-components
export class TWord extends TclToken {
  constructor() {
    super()
    this.components = []
  }
  add(aToken) {
    this.components.push(aToken)
  }
  get str() {
    return this.components.reduce((acc, curr) => (acc += curr.str), '')
  }
  set str(_s) {}
  sub(runtime) {
    return this.components.reduce((acc, curr) => (acc += curr.sub(runtime)), '')
  }
}

// "hello $world"
// or: { hello world }
// The only difference between quoted strings and braced strings, is substitution
export class TStr extends TclToken {}

// [ set x 100 ]
export class TBracket extends TclToken {
  sub(runtime) {
    return runtime.run(this.str).str
  }
}

// $foo
export class TVar extends TclToken {
  sub(runtime) {
    const s = runtime.getVar(this.str)
    if (!s) {
      console.log(this)
      throw new Error('Unknown variable!')
    }
    return s.str
  }
}
