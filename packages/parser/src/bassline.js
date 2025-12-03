/**
 * Bassline - Uniform Resource Router
 *
 * The primary entry point for the Bassline system.
 * Routes URIs to resources (mirrors) via path-based mounting.
 *
 * Inspired by Plan 9's 9P: the namespace is separate from storage.
 * Everything is a resource with a uniform interface: read/write/watch.
 *
 * @example
 * const bl = new Bassline();
 * bl.mount('/cell', cellHandler);
 * bl.mount('/graph/main', new GraphMirror());
 *
 * // All operations go through uniform interface
 * bl.read(ref('bl:///cell/counter'));
 * bl.write(ref('bl:///cell/counter'), 42);
 * bl.watch(ref('bl:///cell/counter'), (value) => console.log(value));
 */

import { Ref, ref, isRef } from './types.js';

/**
 * Bassline - The namespace router
 *
 * Maps URI paths to resources (mirrors). Uses longest-prefix-match
 * to resolve paths to their handlers.
 */
export class Bassline {
  constructor() {
    /** @type {Map<string, Object>} path → handler */
    this._mounts = new Map();

    /** @type {Set<function>} mount change listeners */
    this._mountListeners = new Set();

    /** @type {Map<string, Object>} stores for handlers */
    this._stores = new Map();
  }

  // ============================================================================
  // Mounting
  // ============================================================================

  /**
   * Mount a handler at a path
   *
   * Handlers can be:
   * - A Mirror instance (has read/write/subscribe)
   * - A function (subpath, ref, bassline) => Mirror
   *
   * @param {string} path - Mount path (e.g., '/cell', '/graph/main')
   * @param {Object|function} handler - Mirror or handler function
   */
  mount(path, handler) {
    // Normalize path
    const normalPath = this._normalizePath(path);
    this._mounts.set(normalPath, handler);

    // Notify listeners
    for (const listener of this._mountListeners) {
      listener({ type: 'mount', path: normalPath, handler });
    }
  }

  /**
   * Unmount a path
   * @param {string} path
   */
  unmount(path) {
    const normalPath = this._normalizePath(path);
    const handler = this._mounts.get(normalPath);
    this._mounts.delete(normalPath);

    // Notify listeners
    for (const listener of this._mountListeners) {
      listener({ type: 'unmount', path: normalPath, handler });
    }
  }

  /**
   * List all mounted paths
   * @returns {string[]}
   */
  listMounts() {
    return Array.from(this._mounts.keys());
  }

  /**
   * Get handler at exact path
   * @param {string} path
   * @returns {Object|undefined}
   */
  getMount(path) {
    return this._mounts.get(this._normalizePath(path));
  }

  /**
   * Subscribe to mount changes
   * @param {function} callback - Called with { type, path, handler }
   * @returns {function} Unsubscribe function
   */
  onMountChange(callback) {
    this._mountListeners.add(callback);
    return () => this._mountListeners.delete(callback);
  }

  // ============================================================================
  // Resolution
  // ============================================================================

  /**
   * Resolve a ref to its handler and subpath
   *
   * Uses longest-prefix-match: given mounts at /a and /a/b,
   * /a/b/c resolves to /a/b with subpath c.
   *
   * @param {Ref|string} refOrHref
   * @returns {{ handler: Object, subpath: string, ref: Ref }|undefined}
   */
  resolve(refOrHref) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;

    if (!isRef(r)) {
      throw new Error(`resolve requires a Ref, got: ${typeof refOrHref}`);
    }

    // Only handle bl:// scheme
    if (r.scheme !== 'bl') {
      return undefined;
    }

    const path = r.pathname;

    // Find longest matching mount
    let bestMatch = null;
    let bestLength = -1;

    for (const [mountPath] of this._mounts) {
      if (path === mountPath || path.startsWith(mountPath + '/') || mountPath === '/') {
        const length = mountPath === '/' ? 0 : mountPath.length;
        if (length > bestLength) {
          bestLength = length;
          bestMatch = mountPath;
        }
      }
    }

    if (bestMatch === null) {
      return undefined;
    }

    const handler = this._mounts.get(bestMatch);
    const subpath = bestMatch === '/'
      ? path.slice(1)
      : path.slice(bestMatch.length + 1);

    return { handler, subpath, ref: r };
  }

  /**
   * Get the mirror for a ref (resolving handler functions)
   * @param {Ref|string} refOrHref
   * @returns {Object|undefined} The mirror
   */
  getMirror(refOrHref) {
    const resolved = this.resolve(refOrHref);
    if (!resolved) return undefined;

    const { handler, subpath, ref: r } = resolved;

    // If handler is a function, call it to get mirror
    if (typeof handler === 'function') {
      return handler(subpath, r, this);
    }

    // Otherwise handler is the mirror itself
    return handler;
  }

  // ============================================================================
  // Uniform Resource Interface
  // ============================================================================

  /**
   * Read from a resource
   *
   * Parameters come from the URI query string.
   *
   * @param {Ref|string} refOrHref - Resource to read
   * @returns {*} The value
   */
  read(refOrHref) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    const mirror = this.getMirror(r);

    if (!mirror) {
      throw new Error(`No handler for: ${r.href}`);
    }

    // If mirror has read method that takes ref, use it (new style)
    if (mirror.readRef) {
      return mirror.readRef(r, this);
    }

    // Otherwise use classic read() (backward compat)
    if (mirror.readable === false) {
      throw new Error(`Resource is not readable: ${r.href}`);
    }

    return mirror.read();
  }

  /**
   * Write to a resource
   *
   * For actions, the URI query string carries parameters.
   * The value argument is optional additional data.
   *
   * @param {Ref|string} refOrHref - Resource to write
   * @param {*} [value] - Value to write (optional for actions)
   * @returns {*} Result of the write
   */
  write(refOrHref, value) {
    const r = typeof refOrHref === 'string' ? ref(refOrHref) : refOrHref;
    const mirror = this.getMirror(r);

    if (!mirror) {
      throw new Error(`No handler for: ${r.href}`);
    }

    // If mirror has write method that takes ref, use it (new style)
    if (mirror.writeRef) {
      return mirror.writeRef(r, value, this);
    }

    // Otherwise use classic write(value) (backward compat)
    if (mirror.writable === false) {
      throw new Error(`Resource is not writable: ${r.href}`);
    }

    return mirror.write(value);
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
    const mirror = this.getMirror(r);

    if (!mirror) {
      throw new Error(`No handler for: ${r.href}`);
    }

    // If mirror has watch method that takes ref, use it (new style)
    if (mirror.watchRef) {
      return mirror.watchRef(r, callback, this);
    }

    // Otherwise use classic subscribe(callback) (backward compat)
    if (!mirror.subscribe) {
      throw new Error(`Resource does not support watching: ${r.href}`);
    }

    return mirror.subscribe(callback);
  }

  // ============================================================================
  // Stores (for handler persistence)
  // ============================================================================

  /**
   * Get or create a named store
   * @param {string} name
   * @returns {Map}
   */
  getStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new Map());
    }
    return this._stores.get(name);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Dispose all resources
   */
  dispose() {
    for (const handler of this._mounts.values()) {
      if (typeof handler.dispose === 'function') {
        handler.dispose();
      }
    }
    this._mounts.clear();
    this._mountListeners.clear();
    this._stores.clear();
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

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a Bassline instance
 * @returns {Bassline}
 */
export function createBassline() {
  return new Bassline();
}

export { ref, Ref, isRef };
