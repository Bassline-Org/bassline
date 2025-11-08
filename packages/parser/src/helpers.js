export function normalize(key) {
  if (typeof key === "symbol") {
    return key.description.toUpperCase();
  }
  return key.toUpperCase();
}

export function binding(map) {
  return {
    map,
    getKey(key) {
      const k = normalize(key);
      if (map.has(`?${k}`)) {
        return map.get(`?${k}`);
      }
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
