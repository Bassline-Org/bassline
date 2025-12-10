/**
 * Built-in lattices for Bassline cells.
 *
 * Lattices are code modules that can be loaded via the code store.
 * Reference them as: bl:///code/lattices#maxNumber
 *
 * Each lattice provides:
 * - bottom(): The minimal element
 * - join(a, b): Combine two values (supremum)
 * - lte(a, b): Compare two values (partial order)
 */

// Maximum number lattice - values only go up
export const maxNumber = {
  bottom: () => -Infinity,
  join: (a, b) => Math.max(a, b),
  lte: (a, b) => a <= b
}

// Minimum number lattice - values only go down toward bottom
export const minNumber = {
  bottom: () => Infinity,
  join: (a, b) => Math.min(a, b),
  lte: (a, b) => a >= b  // Reversed - smaller is "higher" in this lattice
}

// Set union lattice - accumulates elements
export const setUnion = {
  bottom: () => [],
  join: (a, b) => {
    const set = new Set([...a, ...b])
    return [...set].sort()
  },
  lte: (a, b) => {
    const setA = new Set(a)
    const setB = new Set(b)
    return [...setA].every(x => setB.has(x))
  }
}

// Last-writer-wins lattice - compares by timestamp
export const lww = {
  bottom: () => ({ value: null, timestamp: 0 }),
  join: (a, b) => {
    // Handle raw values (auto-wrap with timestamp)
    const aWrapped = typeof a?.timestamp === 'number' ? a : { value: a, timestamp: 0 }
    const bWrapped = typeof b?.timestamp === 'number' ? b : { value: b, timestamp: 0 }
    return aWrapped.timestamp >= bWrapped.timestamp ? aWrapped : bWrapped
  },
  lte: (a, b) => {
    const aWrapped = typeof a?.timestamp === 'number' ? a : { value: a, timestamp: 0 }
    const bWrapped = typeof b?.timestamp === 'number' ? b : { value: b, timestamp: 0 }
    return aWrapped.timestamp <= bWrapped.timestamp
  }
}

// Registry of built-in lattices
export const lattices = {
  maxNumber,
  minNumber,
  setUnion,
  lww
}

/**
 * Get a lattice by name
 * @param {string} name - Lattice name (e.g., 'maxNumber')
 * @returns {object|null}
 */
export function getLattice(name) {
  return lattices[name] || null
}
