// Base Resource - materialized runtime object
export class Resource {
  constructor(uri, doc, store) {
    this.uri = uri
    this.store = store
    this._initFromDocument(doc)
  }

  // Override to initialize state from document
  _initFromDocument(doc) {
    this._type = doc.type
    this._data = { ...doc }
  }

  // get() returns a Ref (filtered view)
  // The URIs in the ref ARE the capabilities granted
  get(headers = {}) {
    return this._buildRef(headers)
  }

  // Override to customize ref building (filtering)
  _buildRef(headers) {
    // Default: return all data as the ref
    return {
      type: this._type,
      ...this._data
    }
  }

  // Serialize back to document
  serialize() {
    return {
      type: this._type,
      ...this._data
    }
  }

  // Persist to store
  save() {
    this.store.store(this)
  }

  // Resolve another URI through this resource's store
  resolve(uri) {
    return this.store.resolve(uri)
  }
}
