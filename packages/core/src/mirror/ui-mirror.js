/**
 * UIMirror - Stores UI definitions
 *
 * UI definitions describe how to render data mirrors as forms/lists/etc.
 * They're stored as data with refs to data sources, schemas, etc.
 *
 * Usage:
 *   bl.write('bl:///ui/user-profile', {
 *     type: 'form',
 *     data: { $ref: 'bl:///cell/user' },
 *     fields: [
 *       { path: 'name', label: 'Name', widget: 'text' }
 *     ]
 *   });
 */

import { BaseMirror } from './interface.js';
import { serializeValue } from './serialize.js';

export class UIMirror extends BaseMirror {
  constructor(ref, bassline) {
    super(ref, bassline);
    this._definition = null;
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  get ordering() {
    return 'causal';
  }

  read() {
    return this._definition;
  }

  write(definition) {
    // Basic validation
    if (definition !== null && typeof definition === 'object') {
      if (!definition.type) {
        throw new Error('UI definition must have a type (form, list, grid, panel)');
      }
    }
    this._definition = definition;
    this._notify(definition);
  }

  static get mirrorType() {
    return 'ui';
  }

  toJSON() {
    return {
      $mirror: 'ui',
      uri: this._ref?.href,
      definition: serializeValue(this._definition)
    };
  }
}

/**
 * Create a UI mirror (convenience function)
 */
export function ui(ref, bassline) {
  return new UIMirror(ref, bassline);
}
