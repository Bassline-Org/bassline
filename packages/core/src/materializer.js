import { Resource } from './resource.js'

// Materializer - type dispatch for documents → resources
export class Materializer {
  constructor() {
    this.types = new Map()  // type URI → Resource class
  }

  register(typeUri, ResourceClass) {
    this.types.set(typeUri, ResourceClass)
  }

  materialize(uri, doc, bassline) {
    const ResourceClass = this.types.get(doc.type) ?? Resource
    return new ResourceClass(uri, doc, bassline)
  }
}
