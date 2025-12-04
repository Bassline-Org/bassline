/**
 * RegistryMirror - Introspection into the Bassline system
 *
 * Mounted at bl:///registry, provides:
 * - bl:///registry - List all resolvers
 * - bl:///registry/resolvers - List all resolvers (same as above)
 * - bl:///registry/mirrors - List all resolved mirrors
 * - bl:///registry/info?ref=<uri> - Info about specific mirror
 */

import { BaseMirror } from './interface.js';

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
        // Filter out registry mirrors to avoid recursive loops in explorers
        return this._bassline.listMirrors().filter(uri => !uri.startsWith('bl:///registry'));

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
