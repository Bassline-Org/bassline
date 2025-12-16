export class TclObject {
  constructor(runtime, str) {
    this.runtime = runtime
    this.str = str
  }
  get proc() {
    return this.runtime.getProc(this.str)
  }
  get variable() {
    return this.runtime.getVar(this.str)
  }
}
