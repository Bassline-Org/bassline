/**
 * Cell - A readable/writable mirror holding a single value
 *
 * Cells are the simplest mirror type: a mutable container
 * that notifies subscribers when its value changes.
 *
 * Used by the local:// scheme handler.
 */

import { BaseMirror } from './interface.js';

export class Cell extends BaseMirror {
  constructor(initialValue = undefined) {
    super();
    this._value = initialValue;
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
}

/**
 * Create a Cell mirror
 */
export function cell(initialValue) {
  return new Cell(initialValue);
}
