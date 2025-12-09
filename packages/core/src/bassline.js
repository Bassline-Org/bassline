import { Materializer } from './materializer.js'

// Bassline - orchestration (routing + caching + type dispatch)
export class Bassline {
  constructor() {
    this.stores = new Map()           // prefix → Store
    this.materializer = new Materializer()
    this.cache = new Map()            // uri → Resource
  }

  mount(prefix, store) {
    this.stores.set(prefix, store)
  }

  register(typeUri, ResourceClass) {
    this.materializer.register(typeUri, ResourceClass)
  }

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

  resolve(uri) {
    // Check cache
    if (this.cache.has(uri)) return this.cache.get(uri)

    // Load document from store
    const store = this.storeFor(uri)
    if (!store) return null
    const doc = store.load(uri)
    if (!doc) return null

    // Materialize by type
    const resource = this.materializer.materialize(uri, doc, this)

    // Cache
    this.cache.set(uri, resource)
    return resource
  }

  save(resource) {
    const store = this.storeFor(resource.uri)
    store.save(resource.uri, resource.serialize())
  }
}
