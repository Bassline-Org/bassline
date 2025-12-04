/**
 * Bassline - The System
 *
 * Bassline is the ultimate mirror that resolves refs and manages all mirrors.
 * Refs are self-describing - they carry their own resolution information.
 *
 * @example
 * const bl = new Bassline();
 *
 * // Register middleware to handle ref patterns
 * bl.use('/cell', (ref, bl) => new Cell(ref, bl));
 * bl.use('/action/log', (ref, bl) => new LogAction(ref, bl));
 *
 * // All operations resolve refs to mirrors
 * bl.read('bl:///cell/counter');
 * bl.write('bl:///cell/counter', 42);
 * bl.watch('bl:///cell/counter', (value) => console.log(value));
 */

import { Ref, ref, isRef } from './types.js';

/**
 * Bassline - Resolves refs to mirrors
 *
 * Refs are unique values that carry their own resolution information.
 * Middleware registers to handle patterns and create mirrors on demand.
 */
export class Bassline {
  constructor() {
    /** @type {Map<string, Object>} ref.href → Mirror instance */
    this._mirrors = new Map();

    /** @type {Array<{pattern: string, resolve: function, onWrite?: function, onRead?: function}>} */
    this._resolvers = [];

    /** @type {Set<function>} Write listeners */
    this._writeListeners = new Set();

    /** @type {Set<function>} Read listeners */
    this._readListeners = new Set();
  }

  // ============================================================================
  // Middleware Registration
  // ============================================================================

  /**
   * Register middleware for a pattern
   *
   * @param {string} pattern - Path pattern to match (e.g., '/cell', '/action/log')
   * @param {function|Object} middleware - Resolver function or { resolve, onWrite?, onRead? }
   *
   * @example
   * // Simple resolver
   * bl.use('/cell', (ref, bl) => new Cell(ref, bl));
   *
   * // With event listeners
   * bl.use('/audit', {
   *   resolve: (ref, bl) => new AuditMirror(ref, bl),
   *   onWrite: (ref, value, result, bl) => console.log('Write:', ref.href)
   * });
   */
  use(pattern, middleware) {
    const normalPattern = this._normalizePath(pattern);

    if (typeof middleware === 'function') {
      middleware = { resolve: middleware };
    }

    this._resolvers.push({ pattern: normalPattern, ...middleware });

    // Wire up event listeners if provided
    if (middleware.onWrite) {
      this._writeListeners.add(middleware.onWrite);
    }
    if (middleware.onRead) {
      this._readListeners.add(middleware.onRead);
    }
  }

  // ============================================================================
  // Resolution
  // ============================================================================

  /**
   * Resolve a ref to its mirror
   *
   * If the mirror exists in cache, returns it.
   * Otherwise finds matching middleware, creates mirror, caches and returns it.
   *
   * @param {Ref|string} refOrHref
   * @returns {Object} The mirror
   */
  resolve(refOrHref) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;

    if (!isRef(r)) {
      throw new Error(`resolve requires a Ref, got: ${typeof refOrHref}`);
    }

    // Only handle bl:// scheme
    if (r.scheme !== 'bl') {
      throw new Error(`Unsupported scheme: ${r.scheme}`);
    }

    // Already exists in cache?
    if (this._mirrors.has(r.href)) {
      return this._mirrors.get(r.href);
    }

    // Find matching resolver
    const resolver = this._findResolver(r.pathname);
    if (!resolver) {
      throw new Error(`No resolver for: ${r.href}`);
    }

    // Create mirror and cache it
    const mirror = resolver.resolve(r, this);
    this._mirrors.set(r.href, mirror);
    return mirror;
  }

  /**
   * Find the best matching resolver for a pathname
   * Uses longest-prefix-match
   *
   * @param {string} pathname
   * @returns {Object|null}
   */
  _findResolver(pathname) {
    let best = null;
    let bestLen = -1;

    for (const resolver of this._resolvers) {
      const { pattern } = resolver;
      if (pathname === pattern || pathname.startsWith(pattern + '/')) {
        if (pattern.length > bestLen) {
          best = resolver;
          bestLen = pattern.length;
        }
      }
    }

    return best;
  }

  // ============================================================================
  // Uniform Resource Interface
  // ============================================================================

  /**
   * Read from a resource
   *
   * @param {Ref|string} refOrHref - Resource to read
   * @returns {*} The value
   */
  read(refOrHref) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    const mirror = this.resolve(r);

    if (mirror.readable === false) {
      throw new Error(`Resource is not readable: ${r.href}`);
    }

    const result = mirror.read();

    // Notify listeners
    for (const listener of this._readListeners) {
      listener(r, result, this);
    }

    return result;
  }

  /**
   * Write to a resource
   *
   * @param {Ref|string} refOrHref - Resource to write
   * @param {*} [value] - Value to write
   * @returns {*} Result of the write
   */
  write(refOrHref, value) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    const mirror = this.resolve(r);

    if (mirror.writable === false) {
      throw new Error(`Resource is not writable: ${r.href}`);
    }

    const result = mirror.write(value);

    // Notify listeners
    for (const listener of this._writeListeners) {
      listener(r, value, result, this);
    }

    return result;
  }

  /**
   * Watch a resource for changes
   *
   * @param {Ref|string} refOrHref - Resource to watch
   * @param {function} callback - Called on changes
   * @returns {function} Unsubscribe function
   */
  watch(refOrHref, callback) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    const mirror = this.resolve(r);

    if (!mirror.subscribe) {
      throw new Error(`Resource does not support watching: ${r.href}`);
    }

    return mirror.subscribe(callback);
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to all writes in the system
   *
   * @param {function} callback - Called with (ref, value, result, bassline)
   * @returns {function} Unsubscribe function
   */
  onWrite(callback) {
    this._writeListeners.add(callback);
    return () => this._writeListeners.delete(callback);
  }

  /**
   * Subscribe to all reads in the system
   *
   * @param {function} callback - Called with (ref, result, bassline)
   * @returns {function} Unsubscribe function
   */
  onRead(callback) {
    this._readListeners.add(callback);
    return () => this._readListeners.delete(callback);
  }

  // ============================================================================
  // Introspection
  // ============================================================================

  /**
   * List all resolved mirror refs
   * @returns {string[]}
   */
  listMirrors() {
    return Array.from(this._mirrors.keys());
  }

  /**
   * List all registered resolver patterns
   * @returns {string[]}
   */
  listResolvers() {
    return this._resolvers.map(r => r.pattern);
  }

  /**
   * Check if a ref has been resolved (is in cache)
   * @param {Ref|string} refOrHref
   * @returns {boolean}
   */
  hasResolved(refOrHref) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    return this._mirrors.has(r.href);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Dispose all mirrors and clear state
   */
  dispose() {
    for (const mirror of this._mirrors.values()) {
      if (typeof mirror.dispose === 'function') {
        mirror.dispose();
      }
    }
    this._mirrors.clear();
    this._resolvers = [];
    this._writeListeners.clear();
    this._readListeners.clear();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Normalize a path (ensure leading /, no trailing /)
   * @param {string} path
   * @returns {string}
   */
  _normalizePath(path) {
    let p = path;
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }
}

export { ref, Ref, isRef };
