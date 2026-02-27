/** @param {import('../types').Platform} platform */
export default function (platform) {
  const kResource = Symbol.for('bassline.resource')

  class Garage {
    #parked = new Map()
    #refs = new Map()
    #byResource = new Map()

    park(resourceFn) {
      const resource = resourceFn[kResource]
      if (resource && this.#byResource.has(resource)) {
        return this.#byResource.get(resource)
      }
      const ticket = globalThis.crypto.randomUUID()
      this.#parked.set(ticket, { fn: resourceFn, refs: new Set() })
      if (resource) this.#byResource.set(resource, ticket)
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
      if (entry) return entry.fn
      const ticket = this.#refs.get(token)
      if (ticket) {
        const parkedEntry = this.#parked.get(ticket)
        if (parkedEntry) return parkedEntry.fn
      }
      throw new Error('invalid token')
    }

    redeem(ticket) {
      if (this.#refs.has(ticket)) throw new Error('cannot redeem a reference token')
      const entry = this.#parked.get(ticket)
      if (!entry) throw new Error('invalid ticket')
      for (const ref of entry.refs) this.#refs.delete(ref)
      this.#parked.delete(ticket)
      const resource = entry.fn[kResource]
      if (resource) this.#byResource.delete(resource)
      return entry.fn
    }

    has(token) {
      return this.#parked.has(token) || this.#refs.has(token)
    }
  }

  platform.Garage = Garage
}
