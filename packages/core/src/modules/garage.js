const kResource = Symbol.for('bassline.resource')

export class Garage {
  #parked = new Map()
  #refs = new Map()
  #identity = new Map()

  park(value) {
    const identity = value?.[kResource]
    if (identity && this.#identity.has(identity)) {
      return this.#identity.get(identity)
    }
    const ticket = globalThis.crypto.randomUUID()
    this.#parked.set(ticket, { value, refs: new Set() })
    if (identity) this.#identity.set(identity, ticket)
    return ticket
  }

  mint(ticket) {
    if (!this.#parked.has(ticket)) throw new Error('invalid ticket')
    const ref = globalThis.crypto.randomUUID()
    this.#parked.get(ticket).refs.add(ref)
    this.#refs.set(ref, ticket)
    return ref
  }

  resolve(token) {
    const entry = this.#parked.get(token)
    if (entry) return entry.value
    const ticket = this.#refs.get(token)
    if (ticket) {
      const parkedEntry = this.#parked.get(ticket)
      if (parkedEntry) return parkedEntry.value
    }
    throw new Error('invalid token')
  }

  redeem(ticket) {
    if (this.#refs.has(ticket)) throw new Error('cannot redeem a reference token')
    const entry = this.#parked.get(ticket)
    if (!entry) throw new Error('invalid ticket')
    for (const ref of entry.refs) this.#refs.delete(ref)
    this.#parked.delete(ticket)
    const identity = entry.value?.[kResource]
    if (identity) this.#identity.delete(identity)
    return entry.value
  }

  has(token) {
    return this.#parked.has(token) || this.#refs.has(token)
  }
}

/** @param {import('../types').Platform} platform */
export default function (platform) {
  platform.Garage = Garage
}
