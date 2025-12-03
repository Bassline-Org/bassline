/**
 * RefRegistry - Resolves Refs to Mirrors via scheme handlers
 *
 * Each URI scheme (local://, fold://, ws://, etc.) has a handler
 * that knows how to create/resolve mirrors for that scheme.
 */

import { Ref, isRef } from '../types.js';

export class RefRegistry {
  constructor() {
    /** Map<scheme, (ref, registry) => Mirror> */
    this._schemeHandlers = new Map();

    /** Map<type, (subpath, ref, registry) => Mirror> - type handlers for bl:// */
    this._typeHandlers = new Map();

    /** Map<href, Mirror> - memoized lookups */
    this._cache = new Map();

    /** Map<name, Map<key, value>> - named stores for various purposes */
    this._stores = new Map();
  }

  /**
   * Register a handler for a URI scheme
   * @param {string} scheme - The scheme (e.g., "local", "fold", "ws")
   * @param {function} handler - (ref: Ref, registry: RefRegistry) => Mirror
   */
  registerScheme(scheme, handler) {
    this._schemeHandlers.set(scheme, handler);
  }

  /**
   * Get or create a named store
   * Used by handlers that need persistent storage
   * @param {string} name - Store name (e.g., "cells", "peers", "actions")
   * @returns {Map}
   */
  getStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new Map());
    }
    return this._stores.get(name);
  }

  // ============================================================================
  // Type Registry (for bl:// path-based routing)
  // ============================================================================

  /**
   * Register a type handler for bl:// URIs
   * @param {string} type - The type (first path segment, e.g., "cell", "fold", "action")
   * @param {function} handler - (subpath: string, ref: Ref, registry: RefRegistry) => Mirror
   */
  registerType(type, handler) {
    this._typeHandlers.set(type, handler);
  }

  /**
   * Get a type handler
   * @param {string} type
   * @returns {function|undefined}
   */
  getTypeHandler(type) {
    return this._typeHandlers.get(type);
  }

  /**
   * Check if a type is registered
   * @param {string} type
   * @returns {boolean}
   */
  hasType(type) {
    return this._typeHandlers.has(type);
  }

  /**
   * List all registered types
   * @returns {string[]}
   */
  listTypes() {
    return Array.from(this._typeHandlers.keys());
  }

  /**
   * Lookup a ref and return its mirror (memoized)
   * @param {Ref} ref
   * @returns {Mirror|undefined}
   */
  lookup(ref) {
    if (!isRef(ref)) {
      throw new Error(`lookup requires a Ref, got: ${typeof ref}`);
    }

    // Check cache first
    if (this._cache.has(ref.href)) {
      return this._cache.get(ref.href);
    }

    // Find handler for this scheme
    const handler = this._schemeHandlers.get(ref.scheme);
    if (!handler) {
      return undefined;
    }

    // Create mirror via handler
    const mirror = handler(ref, this);
    if (mirror) {
      this._cache.set(ref.href, mirror);
    }

    return mirror;
  }

  /**
   * Convenience: resolve ref to its current value
   * @param {Ref} ref
   * @returns {*} The current value, or undefined if not readable
   */
  resolve(ref) {
    const mirror = this.lookup(ref);
    return mirror?.readable ? mirror.read() : undefined;
  }

  /**
   * Check if a scheme is registered
   * @param {string} scheme
   * @returns {boolean}
   */
  hasScheme(scheme) {
    return this._schemeHandlers.has(scheme);
  }

  /**
   * Clear the cache (mirrors are recreated on next lookup)
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Dispose all cached mirrors and clear stores
   */
  dispose() {
    for (const mirror of this._cache.values()) {
      if (typeof mirror.dispose === 'function') {
        mirror.dispose();
      }
    }
    this._cache.clear();
    this._stores.clear();
  }
}

// ============================================================================
// Global Registry
// ============================================================================

let globalRegistry = null;

/**
 * Get the global registry (creates one if needed)
 */
export function getRegistry() {
  if (!globalRegistry) {
    globalRegistry = new RefRegistry();
  }
  return globalRegistry;
}

/**
 * Set the global registry
 */
export function setRegistry(registry) {
  globalRegistry = registry;
}

/**
 * Reset the global registry (for testing)
 */
export function resetRegistry() {
  if (globalRegistry) {
    globalRegistry.dispose();
  }
  globalRegistry = null;
}
