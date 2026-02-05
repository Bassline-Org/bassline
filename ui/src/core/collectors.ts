/**
 * Utilities for collecting values from prototype chains.
 * Used by hooks to gather views, tools, and actions from objects and their prototypes.
 */

/**
 * Collect producer functions from an object's prototype chain.
 *
 * Walks up the prototype chain starting from target, collecting all producers
 * defined on each prototype. Stops when shouldInherit returns false for a prototype,
 * or when reaching Object.prototype.
 *
 * @param target - The object to start collecting from
 * @param symbol - The symbol key to look for producers under
 * @param shouldInherit - Function that returns whether to continue up the chain
 * @returns Array of all collected producers, in prototype chain order
 */
export function collectFromPrototypeChain<T>(
  target: object,
  symbol: symbol,
  shouldInherit: (obj: unknown) => boolean
): T[] {
  const allProducers: T[] = []
  let current: object | null = target

  while (current !== null) {
    if (current !== target && !shouldInherit(current)) {
      break
    }

    if (symbol in current) {
      const producers = (current as any)[symbol]
      if (Array.isArray(producers)) {
        allProducers.push(...producers)
      }
    }

    current = Object.getPrototypeOf(current)
    if (current === Object.prototype || current === null) {
      break
    }
  }

  return allProducers
}
