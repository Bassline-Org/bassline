// Resource - materialized runtime object
export class Resource {
  constructor(uri, doc, bassline) {
    this.uri = uri
    this.bassline = bassline
    this._initFromDocument(doc)
  }

  _initFromDocument(doc) {
    this._type = doc.type
    this._data = { ...doc }
  }

  get(headers = {}) {
    return this._buildRef(headers)
  }

  _buildRef(headers) {
    return { type: this._type, ...this._data }
  }

  serialize() {
    return { type: this._type, ...this._data }
  }

  save() {
    this.bassline.save(this)
  }

  resolve(uri) {
    return this.bassline.resolve(uri)
  }
}
