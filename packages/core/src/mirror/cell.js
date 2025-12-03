/**
 * Cell - A readable/writable mirror holding a single value
 *
 * Cells are the simplest mirror type: a mutable container
 * that notifies subscribers when its value changes.
 *
 * Initial value can be passed via ref query param: ?initial=42
 */

import { BaseMirror } from './interface.js';
import { serializeValue } from './serialize.js';

/**
 * Parse a value from string (for query params)
 */
function parseValue(str) {
  if (str === null || str === undefined) return undefined;
  const num = Number(str);
  if (!isNaN(num)) return num;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return str;
}

export class Cell extends BaseMirror {
  /**
   * @param {Ref} ref - The ref this cell is bound to
   * @param {Bassline} bassline - The bassline system
   */
  constructor(ref, bassline) {
    super(ref, bassline);
    const initial = ref.searchParams.get('initial');
    this._value = parseValue(initial);
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
      uri: this._ref?.href,
      value: serializeValue(this._value)
    };
  }
}

/**
 * Create a Cell mirror (convenience function for tests)
 * Note: In normal usage, cells are created via middleware resolution
 */
export function cell(ref, bassline) {
  return new Cell(ref, bassline);
}
