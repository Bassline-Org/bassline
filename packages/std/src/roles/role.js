import { createController } from '@bassline/core'

export class Role {
  controller
  constructor() {
    throw new Error('dont use the constructor directly, use Role.match instead')
  }
  get ctl() {
    return this.controller.ctl
  }
  onClose(fn, signal) {
    return this.ctl.onClose(fn, signal)
  }
  close() {
    return this.controller.close()
  }
  init(msg) {
    this.msg = msg
    this.controller = createController()
  }
  static requires = []
  static match(msg) {
    for (const cap of this.requires) {
      if (!cap.check(msg)) return null
    }
    const inst = Object.create(this.prototype)
    inst.init(msg)
    return inst
  }
}
