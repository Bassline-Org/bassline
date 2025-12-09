// Router builder - define routes hierarchically, then install on Bassline

export class RouterBuilder {
  constructor(prefix = '') {
    this.prefix = prefix
    this.definitions = []
  }

  route(pattern, config) {
    // Handle '/' as "self" - don't add trailing slash
    const fullPattern = pattern === '/' ? this.prefix : this.prefix + pattern
    this.definitions.push({ pattern: fullPattern, config })
    return this
  }

  get(pattern, handler) {
    return this.route(pattern, { get: handler })
  }

  put(pattern, handler) {
    return this.route(pattern, { put: handler })
  }

  scope(prefix, fn) {
    const scoped = new RouterBuilder(this.prefix + prefix)
    fn(scoped)
    this.definitions.push(...scoped.definitions)
    return this
  }

  install(bassline) {
    for (const { pattern, config } of this.definitions) {
      bassline.route(pattern, config)
    }
    return bassline
  }
}

// Convenience: create a scoped router builder
export function routes(prefix, fn) {
  const builder = new RouterBuilder(prefix)
  fn(builder)
  return builder
}
