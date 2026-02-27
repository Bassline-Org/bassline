/** @param {import('../types').Platform} platform */
export default function gate(platform) {
  const {
    classes: { Scope },
    utils: { hasKeys },
  } = platform

  /**
   * GatedScope — wraps a scope and checks capabilities before forwarding.
   *
   * Declarative mode:
   *   GatedScope({ target, capabilities: { get: true, put: false, walk: ['cells'] } })
   *
   * Function mode:
   *   GatedScope({ target, check(msg) { return true/false or throw } })
   *
   * Capabilities:
   *   - get: boolean — allow/deny all reads (listing, has, meta, at)
   *   - put: boolean — allow/deny all writes
   *   - walk: string[] — restrict which names can be walked/resolved (omit to allow all)
   */
  class GatedScope extends Scope {
    #target
    #capabilities
    #check

    constructor({ target, capabilities, check } = {}) {
      super()
      if (!target) throw new Error('target required')
      this.#target = target
      this.#capabilities = capabilities ?? null
      this.#check = check ?? null
    }

    #allow(msg) {
      if (this.#check) {
        const result = this.#check(msg)
        if (result === false) throw new Error('access denied')
        return
      }

      if (!this.#capabilities) return

      const isWrite = hasKeys(msg, 'put')

      // Extract the target name from any message type
      const targetName = msg.at ?? msg.has ?? msg.meta
        ?? msg.walk?.split?.('/')?.[0] ?? msg.walk?.[0]

      if (isWrite) {
        if (this.#capabilities.put === false) throw new Error('write denied')
        if (this.#capabilities.walk && targetName &&
            !this.#capabilities.walk.includes(targetName)) {
          throw new Error(`access denied: ${targetName}`)
        }
        return
      }

      // It's a read
      if (this.#capabilities.get === false) throw new Error('read denied')

      // Check walk restrictions on reads
      if (this.#capabilities.walk && targetName &&
          !this.#capabilities.walk.includes(targetName)) {
        throw new Error(`access denied: ${targetName}`)
      }
    }

    get(msg = {}) {
      this.#allow(msg)
      return this.#target(msg)
    }

    put(body, headers = {}) {
      this.#allow({ put: body, ...headers })
      return this.#target({ put: body, ...headers })
    }

    accept(aVisitor) {
      return aVisitor.visitGatedScope?.(this) ?? aVisitor.visitScope?.(this) ?? super.accept(aVisitor)
    }
  }

  platform.define({ GatedScope })
}
