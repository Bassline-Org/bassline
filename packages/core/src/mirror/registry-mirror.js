/**
 * RegistryMirror - Introspection into the Bassline system
 *
 * Mounted at bl:///registry, provides:
 * - bl:///registry - List all resolvers
 * - bl:///registry/resolvers - List all resolvers (same as above)
 * - bl:///registry/mirrors - List all resolved mirrors
 * - bl:///registry/info?ref=<uri> - Info about specific mirror
 *
 * Query selectors for /mirrors:
 * - ?type=cell - Filter by mirror type
 * - ?pattern=ui/* - Filter by URI pattern (glob-like)
 * - ?has=data - Filter by property existence in value
 * - ?where=type:form - Filter by value content
 */

import { BaseMirror } from './interface.js';

/**
 * Convert glob pattern to regex
 * Supports * (any chars) and ? (single char)
 */
function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^bl:///${escaped}$`);
}

/**
 * Check if value has property at path
 * Path uses dot notation: "data.$ref" checks value.data.$ref
 */
function hasProperty(value, path) {
  if (value === null || value === undefined) return false;
  if (path === '') return true;

  const parts = path.split('.');
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return false;
    if (typeof current !== 'object') return false;
    if (!(part in current)) return false;
    current = current[part];
  }
  return true;
}

/**
 * Get value at path
 * Returns undefined if path doesn't exist
 */
function getPath(value, path) {
  if (value === null || value === undefined) return undefined;
  if (path === '') return value;

  const parts = path.split('.');
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (!(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

export class RegistryMirror extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
  }

  get readable() {
    return true;
  }

  get writable() {
    return false;
  }

  read() {
    const subpath = this._getSubpath();

    switch (subpath) {
      case '':
      case 'resolvers':
        return this._bassline.listResolvers();

      case 'mirrors':
        return this._getFilteredMirrors();

      case 'info':
        return this._getMirrorInfo();

      default:
        throw new Error(`Unknown registry path: ${subpath}`);
    }
  }

  /**
   * Get info about a specific mirror
   * Uses ?ref=<uri> query parameter
   */
  _getMirrorInfo() {
    const targetRef = this._ref.searchParams.get('ref');
    if (!targetRef) {
      throw new Error('Missing ref parameter for info query');
    }

    // Check if mirror exists
    if (!this._bassline.hasResolved(targetRef)) {
      return null;
    }

    // Get the mirror and return its info
    const mirror = this._bassline.resolve(targetRef);
    return {
      uri: targetRef,
      type: mirror.constructor.mirrorType || 'unknown',
      readable: mirror.readable,
      writable: mirror.writable,
      ordering: mirror.ordering || null
    };
  }

  /**
   * Get mirrors with optional filtering via query params
   * - ?type=cell - Filter by mirror type
   * - ?pattern=ui/* - Filter by URI pattern (glob-like)
   * - ?has=data - Filter by property existence in value
   * - ?where=type:form - Filter by value content
   */
  _getFilteredMirrors() {
    // Start with all mirrors, excluding registry to avoid recursion
    let mirrors = this._bassline.listMirrors()
      .filter(uri => !uri.startsWith('bl:///registry'));

    // Filter by mirror type
    const type = this._ref.searchParams.get('type');
    if (type) {
      mirrors = mirrors.filter(uri => {
        const mirror = this._bassline.resolve(uri);
        return mirror.constructor.mirrorType === type;
      });
    }

    // Filter by URI pattern (glob-like)
    const pattern = this._ref.searchParams.get('pattern');
    if (pattern) {
      const regex = patternToRegex(pattern);
      mirrors = mirrors.filter(uri => regex.test(uri));
    }

    // Filter by property existence in value
    const has = this._ref.searchParams.get('has');
    if (has) {
      mirrors = mirrors.filter(uri => {
        const mirror = this._bassline.resolve(uri);
        if (!mirror.readable) return false;
        const value = mirror.read();
        return hasProperty(value, has);
      });
    }

    // Filter by value content (where=path:expected)
    const where = this._ref.searchParams.get('where');
    if (where) {
      const colonIdx = where.indexOf(':');
      if (colonIdx > 0) {
        const path = where.slice(0, colonIdx);
        const expected = where.slice(colonIdx + 1);
        mirrors = mirrors.filter(uri => {
          const mirror = this._bassline.resolve(uri);
          if (!mirror.readable) return false;
          const value = mirror.read();
          const actual = getPath(value, path);
          return String(actual) === expected;
        });
      }
    }

    return mirrors;
  }

  write() {
    throw new Error('Registry is not writable');
  }

  _getSubpath() {
    const path = this._ref.pathname;
    if (path === '/registry') return '';
    if (path.startsWith('/registry/')) return path.slice(10);
    return path;
  }

  static get mirrorType() {
    return 'registry';
  }

  toJSON() {
    return {
      $mirror: 'registry',
      uri: this._ref?.href
    };
  }
}
