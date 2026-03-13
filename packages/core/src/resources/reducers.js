import { message, DoesNotUnderstandError } from '../kernel/grammar.js'

export const read = message({})
export const write = message({ put: true })

export function dispatch(impl, msg) {
  if (write.match(msg)) return impl.write(msg.put)
  if (read.match(msg)) return impl.read()
  return impl.dnu(msg)
}

export class Slot {
  value = null
  read() {
    return this.value
  }
  write(value) {
    this.value = value
    return value
  }
  dnu(msg) {
    throw new DoesNotUnderstandError(msg)
  }
}

export class Max extends Slot {
  value = -Infinity
  write(value) {
    this.value = Math.max(this.value, value)
    return this.value
  }
}

export class Min extends Slot {
  value = Infinity
  write(value) {
    this.value = Math.min(this.value, value)
    return this.value
  }
}

export class Union extends Slot {
  value = new Set()
  write(value) {
    this.value = new Set([...this.value, ...value])
    return this.value
  }
}

const a = dispatch.bind(null, new Max())

console.log(a())
console.log(a({ put: 1 }))
console.log(a({ put: 2 }))
console.log(a({}))
console.log(a({ put: 1 }))
console.log(a())