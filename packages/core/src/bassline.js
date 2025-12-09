// Bassline - routes URIs to stores
// Just a router. Store is the authority.
export class Bassline {
  constructor() {
    this.stores = new Map()  // prefix → Store
  }

  // Mount a store at a prefix
  mount(prefix, store) {
    this.stores.set(prefix, store)
  }

  // Find store for a URI (longest prefix match)
  storeFor(uri) {
    const path = new URL(uri).pathname
    let best = null
    let bestLen = 0

    for (const [prefix, store] of this.stores) {
      if (path.startsWith(prefix) && prefix.length > bestLen) {
        best = store
        bestLen = prefix.length
      }
    }

    return best
  }

  // Resolve: URI → Resource via the appropriate store
  resolve(uri) {
    const store = this.storeFor(uri)
    if (!store) return null
    return store.resolve(uri)
  }
}
