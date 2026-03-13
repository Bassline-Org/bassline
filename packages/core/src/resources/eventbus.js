import { Grammar } from '../kernel/grammar.js'

/**
 * EventBus grammar.
 *
 * Message shapes:
 *   { put: { type, ...data } }           → publish(event)
 *   { subscribe: topic, callback: fn }   → subscribe(topic, callback) → unsubscribe fn
 *   {}                                   → topics()
 */
export class EventBusGrammar extends Grammar {
  dispatch(msg, impl) {
    if ('put' in msg) return impl.publish(msg.put)
    if ('subscribe' in msg) return impl.subscribe(msg.subscribe, msg.callback)
    return impl.topics()
  }
}

/**
 * EventBus backend — publish/subscribe event system.
 *
 * Algebra:
 *   publish(event)              → void        (event is { type, ...data })
 *   subscribe(topic, callback)  → unsubscribe fn
 *   topics()                    → topic[]
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #subscribers = new Map()

  /**
   * @param {{ type: string, [key: string]: unknown }} event
   */
  publish(event) {
    if (!event || typeof event.type !== 'string') {
      throw new Error('event must have a type')
    }
    const { type, ...data } = event
    const subs = this.#subscribers.get(type)
    if (subs) {
      for (const cb of subs) cb(data)
    }
  }

  /**
   * @param {string} topic
   * @param {Function} callback
   * @returns {() => void} unsubscribe function
   */
  subscribe(topic, callback) {
    if (!this.#subscribers.has(topic)) {
      this.#subscribers.set(topic, new Set())
    }
    this.#subscribers.get(topic).add(callback)
    return () => {
      const subs = this.#subscribers.get(topic)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) this.#subscribers.delete(topic)
      }
    }
  }

  /**
   * @returns {string[]}
   */
  topics() {
    return [...this.#subscribers.keys()]
  }
}
