/**
 * RegistryMirror - Introspection into the Bassline system
 *
 * Mounted at bl:///registry, provides:
 * - bl:///registry - List all resolvers
 * - bl:///registry/mirrors - List all resolved mirrors
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
        return this._bassline.listMirrors();

      default:
        throw new Error(`Unknown registry path: ${subpath}`);
    }
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
