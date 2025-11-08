/**
 * Normalize a key to uppercase for case-insensitive lookups
 */
export function normalize(key) {
  if (typeof key === "symbol") {
    return key.description.toUpperCase();
  }
  return key.toUpperCase();
}

/**
 * Create a binding wrapper for variable bindings map
 *
 * Bindings now contain typed values from the graph:
 * - Words (normalized identifiers)
 * - Strings (case-sensitive literals)
 * - Numbers
 * - PatternVars (in patterns)
 *
 * Usage:
 *   const b = binding(bindingsMap);
 *   const value = b.get("name");  // Returns typed value (Word, string, number, etc.)
 *   const values = b.get(["id", "text"]);  // Returns array of typed values
 */
export function binding(map) {
  return {
    map,
    getKey(key) {
      const k = normalize(key);
      // Try with ? prefix first (pattern variables)
      if (map.has(`?${k}`)) {
        return map.get(`?${k}`);
      }
      // Try without prefix
      if (map.has(k)) {
        return map.get(k);
      }
      return undefined;
    },
    get(key) {
      if (Array.isArray(key)) {
        return key.map((k) => this.getKey(k));
      }
      if (typeof key === "string") {
        return this.getKey(key);
      }
      throw new Error(`Invalid key: ${key}`);
    },
  };
}
