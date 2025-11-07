/**
 * Binding wrapper that normalizes variable name casing
 * Since parser uppercases all variables, this allows case-insensitive access
 */
export class Binding {
  constructor(map) {
    this._map = map;
  }

  get(key) {
    const normalized = typeof key === 'string' ? key.toUpperCase() : key;
    return this._map.get(normalized);
  }

  set(key, value) {
    const normalized = typeof key === 'string' ? key.toUpperCase() : key;
    return this._map.set(normalized, value);
  }

  has(key) {
    const normalized = typeof key === 'string' ? key.toUpperCase() : key;
    return this._map.has(normalized);
  }

  entries() {
    return this._map.entries();
  }

  keys() {
    return this._map.keys();
  }

  values() {
    return this._map.values();
  }

  get size() {
    return this._map.size;
  }
}
