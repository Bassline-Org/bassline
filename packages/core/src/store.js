// Abstract Store - pure document storage
export class Store {
  load(uri) { throw new Error('abstract') }
  save(uri, doc) { throw new Error('abstract') }
}

// In-memory store
export class MemoryStore extends Store {
  constructor() {
    super()
    this.docs = new Map()
  }

  load(uri) {
    return this.docs.get(uri) ?? null
  }

  save(uri, doc) {
    this.docs.set(uri, doc)
  }
}
