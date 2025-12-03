/**
 * RegistryMirror - Self-describing namespace resource
 *
 * Makes the Bassline namespace itself a resource that can be
 * queried and modified through the uniform interface.
 *
 * Mounted at bl:///registry, provides:
 * - bl:///registry/mounts - List all mounts
 * - bl:///registry/mount - Add/remove mounts (write)
 * - bl:///registry/stores - List all stores
 *
 * @example
 * // Query the namespace
 * bl.read(ref('bl:///registry/mounts'));
 * // → { '/cell': [handler], '/graph/main': [handler], ... }
 *
 * // Mount via the registry itself
 * bl.write(ref('bl:///registry/mount'), { path: '/custom', handler: ... });
 *
 * // Watch for namespace changes
 * bl.watch(ref('bl:///registry/mounts'), (change) => { ... });
 */

import { BaseMirror } from './interface.js';

export class RegistryMirror extends BaseMirror {
  /**
   * @param {import('../bassline.js').Bassline} bassline - The Bassline instance
   */
  constructor(bassline) {
    super();
    this._bassline = bassline;
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  /**
   * Read registry state based on ref path
   * @param {import('../types.js').Ref} ref
   * @param {import('../bassline.js').Bassline} bassline
   * @returns {*}
   */
  readRef(ref, bassline) {
    const subpath = this._getSubpath(ref);

    switch (subpath) {
      case '':
      case 'mounts':
        return this._getMountsInfo();

      case 'stores':
        return this._getStoresInfo();

      default:
        // Check for specific mount: /registry/mount/cell
        if (subpath.startsWith('mount/')) {
          const path = '/' + subpath.slice(6);
          const handler = this._bassline.getMount(path);
          return handler ? this._describeHandler(path, handler) : undefined;
        }

        throw new Error(`Unknown registry path: ${subpath}`);
    }
  }

  /**
   * Write to registry (mount/unmount)
   * @param {import('../types.js').Ref} ref
   * @param {*} value
   * @param {import('../bassline.js').Bassline} bassline
   * @returns {*}
   */
  writeRef(ref, value, bassline) {
    const subpath = this._getSubpath(ref);

    switch (subpath) {
      case 'mount':
        // Mount a new handler: { path, handler }
        if (!value || typeof value.path !== 'string') {
          throw new Error('mount requires { path: string, handler: object|function }');
        }
        this._bassline.mount(value.path, value.handler);
        return { mounted: value.path };

      case 'unmount':
        // Unmount a path
        if (typeof value === 'string') {
          this._bassline.unmount(value);
          return { unmounted: value };
        }
        if (value && typeof value.path === 'string') {
          this._bassline.unmount(value.path);
          return { unmounted: value.path };
        }
        throw new Error('unmount requires path string or { path: string }');

      default:
        throw new Error(`Unknown registry write path: ${subpath}`);
    }
  }

  /**
   * Watch for registry changes
   * @param {import('../types.js').Ref} ref
   * @param {function} callback
   * @param {import('../bassline.js').Bassline} bassline
   * @returns {function} Unsubscribe
   */
  watchRef(ref, callback, bassline) {
    const subpath = this._getSubpath(ref);

    if (subpath === '' || subpath === 'mounts') {
      return this._bassline.onMountChange(callback);
    }

    throw new Error(`Cannot watch registry path: ${subpath}`);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  _getSubpath(ref) {
    // Path is /registry/... , extract what comes after /registry
    const path = ref.pathname;
    if (path === '/registry') return '';
    if (path.startsWith('/registry/')) return path.slice(10);
    return path;
  }

  _getMountsInfo() {
    const mounts = {};
    for (const path of this._bassline.listMounts()) {
      const handler = this._bassline.getMount(path);
      mounts[path] = this._describeHandler(path, handler);
    }
    return mounts;
  }

  _getStoresInfo() {
    const stores = {};
    for (const [name, store] of this._bassline._stores) {
      stores[name] = {
        size: store.size,
        keys: Array.from(store.keys())
      };
    }
    return stores;
  }

  _describeHandler(path, handler) {
    if (typeof handler === 'function') {
      return {
        type: 'function',
        name: handler.name || 'anonymous'
      };
    }

    return {
      type: handler.constructor?.name || 'object',
      readable: handler.readable ?? null,
      writable: handler.writable ?? null
    };
  }
}

/**
 * Create and mount the registry mirror on a Bassline instance
 * @param {import('../bassline.js').Bassline} bassline
 * @returns {RegistryMirror}
 */
export function mountRegistryMirror(bassline) {
  const mirror = new RegistryMirror(bassline);
  bassline.mount('/registry', mirror);
  return mirror;
}
