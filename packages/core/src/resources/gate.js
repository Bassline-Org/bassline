import { Grammar } from '../kernel/grammar.js'
import { Scope } from './scope.js'

/**
 * GatedScopeGrammar — checks access before forwarding messages to a target resource function.
 *
 * The gate operates at the message level: it checks capabilities against the incoming
 * message, then forwards the entire message to the target resource function.
 */
class GatedScopeGrammar extends Grammar {
  dispatch(msg, impl) {
    impl.allow(msg)
    return impl.forward(msg)
  }
}

/**
 * GatedScope backend — wraps a target resource function and checks capabilities.
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
export class GatedScope extends Scope {
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

  allow(msg) {
    if (this.#check) {
      const result = this.#check(msg)
      if (result === false) throw new Error('access denied')
      return
    }

    if (!this.#capabilities) return

    const isWrite = 'put' in msg

    // Extract the target name from any message type
    const targetName = msg.at ?? msg.has ?? msg.meta
      ?? (typeof msg.walk === 'string' ? msg.walk.split('/')[0] : msg.walk?.[0])

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

  forward(msg) {
    return this.#target(msg)
  }

  accept(visitor) {
    return visitor.visitGatedScope?.(this) ?? visitor.visitScope?.(this) ?? visitor.visitResource?.(this)
  }
}

const gatedScopeGrammar = new GatedScopeGrammar()

/** @param {import('../types').Platform} platform */
export default function gate(platform) {
  platform.define(
    { GatedScope },
    { GatedScope: gatedScopeGrammar },
  )
}
