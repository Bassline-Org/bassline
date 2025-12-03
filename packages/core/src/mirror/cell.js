/**
 * Cell - A readable/writable mirror holding a single value
 *
 * Cells are the simplest mirror type: a mutable container
 * that notifies subscribers when its value changes.
 *
 * Used by the local:// scheme handler.
 */

import { BaseMirror } from './interface.js';
import { serializeValue, reviveValue, registerMirrorType } from './serialize.js';

export class Cell extends BaseMirror {
  /**
   * @param {*} initialValue - Initial value for the cell
   * @param {string} [uri] - Optional URI for this cell (for serialization)
   */
  constructor(initialValue = undefined, uri = null) {
    super();
    this._value = initialValue;
    this._uri = uri;
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  read() {
    return this._value;
  }

  write(value) {
    this._value = value;
    this._notify(value);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  static get mirrorType() {
    return 'cell';
  }

  toJSON() {
    return {
      $mirror: 'cell',
      uri: this._uri,
      value: serializeValue(this._value)
    };
  }

  merge(data) {
    if (data.value !== undefined) {
      this.write(reviveValue(data.value));
    }
  }

  static fromJSON(data, registry = null) {
    const value = reviveValue(data.value, registry);
    return new Cell(value, data.uri);
  }
}

/**
 * Create a Cell mirror
 */
export function cell(initialValue, uri = null) {
  return new Cell(initialValue, uri);
}

// Register with serialization system
registerMirrorType('cell', Cell.fromJSON);
