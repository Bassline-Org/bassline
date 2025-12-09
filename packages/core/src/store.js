import { Resource } from './resource.js'

// Abstract Store - the authority for resources
// Owns resources, materializes them, stores them
export class Store {
  constructor() {
    this.cache = new Map()  // uri → Resource (1 URI = 1 Resource)
  }

  // Materialize: URI → Resource (full capabilities)
  resolve(uri) {
    // Check cache - ensures identity (1 URI = 1 Resource)
    if (this.cache.has(uri)) {
      return this.cache.get(uri)
    }

    // Load document from storage
    const doc = this._load(uri)
    if (!doc) return null

    // Create resource with full capabilities
    const resource = this._materialize(uri, doc)
    this.cache.set(uri, resource)
    return resource
  }

  // Store: Resource → Document (serialize and save)
  store(resource) {
    const doc = resource.serialize()
    this._save(resource.uri, doc)
  }

  // Override in subclasses for persistence
  _load(uri) { throw new Error('abstract') }
  _save(uri, doc) { throw new Error('abstract') }

  // Override to create type-specific resources
  _materialize(uri, doc) {
    return new Resource(uri, doc, this)
  }
}

// In-memory store for testing and simple use cases
export class MemoryStore extends Store {
  constructor() {
    super()
    this.docs = new Map()
  }

  _load(uri) {
    return this.docs.get(uri) ?? null
  }

  _save(uri, doc) {
    this.docs.set(uri, doc)
  }
}