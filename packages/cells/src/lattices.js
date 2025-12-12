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
  lte: (a, b) => a <= b,
}

// Minimum number lattice - values only go down toward bottom
export const minNumber = {
  bottom: () => Infinity,
  join: (a, b) => Math.min(a, b),
  lte: (a, b) => a >= b, // Reversed - smaller is "higher" in this lattice
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
    return [...setA].every((x) => setB.has(x))
  },
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
  },
}

// Object lattice - deep merge with later values winning conflicts
export const object = {
  bottom: () => ({}),
  join: (a, b) => {
    // Shallow merge for now - b overwrites a for conflicts
    return { ...(a || {}), ...(b || {}) }
  },
  lte: (a, b) => {
    // a <= b if all keys in a exist in b with same values
    const aObj = a || {}
    const bObj = b || {}
    return Object.keys(aObj).every((k) => k in bObj)
  },
}

// Counter lattice - increment only (add values together)
export const counter = {
  bottom: () => 0,
  join: (a, b) => (a ?? 0) + (b ?? 0),
  lte: (a, b) => (a ?? 0) <= (b ?? 0), // Lower counts are below higher counts
}

// Boolean lattice - once true, stays true
export const boolean = {
  bottom: () => false,
  join: (a, b) => a || b,
  lte: (a, b) => !a || b, // false <= anything, true <= true only
}

// Set intersection lattice - values get more constrained (smaller)
// Empty set [] is "top" (contradiction/unsatisfiable)
// null means "unconstrained" (universal set / bottom)
// Disjoint sets intersect to [] - a detectable contradiction state
export const setIntersection = {
  bottom: () => null,
  join: (a, b) => {
    if (a === null) return b
    if (b === null) return a
    if (!Array.isArray(a) || !Array.isArray(b)) return []
    const setA = new Set(a)
    return [...new Set([...b].filter((x) => setA.has(x)))].sort()
  },
  lte: (a, b) => {
    // a ≤ b means a is less constrained (superset of b)
    if (a === null) return true // unconstrained ≤ everything
    if (b === null) return false // constrained is not ≤ unconstrained
    if (!Array.isArray(b)) return true
    if (!Array.isArray(a)) return false
    const setA = new Set(a)
    return b.every((x) => setA.has(x)) // b ⊆ a means a ≤ b in constraint ordering
  },
}

// Registry of built-in lattices
export const lattices = {
  maxNumber,
  minNumber,
  setUnion,
  setIntersection,
  lww,
  object,
  counter,
  boolean,
}

/**
 * Get a lattice by name
 * @param {string} name - Lattice name (e.g., 'maxNumber')
 * @returns {object|null}
 */
export function getLattice(name) {
  return lattices[name] || null
}
