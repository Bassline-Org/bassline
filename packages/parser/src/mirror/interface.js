/**
 * Mirror Interface
 *
 * Mirrors provide access to resources identified by Refs.
 * They have a simple interface: readable, writable, read(), write(), subscribe().
 */

/**
 * Check if an object implements the Mirror interface
 */
export function isMirror(obj) {
  return obj !== null &&
    typeof obj === 'object' &&
    typeof obj.readable === 'boolean' &&
    typeof obj.writable === 'boolean' &&
    typeof obj.read === 'function' &&
    typeof obj.write === 'function' &&
    typeof obj.subscribe === 'function';
}

/**
 * Base class for Mirror implementations
 *
 * Provides subscriber management and notification.
 * Subclasses override readable, writable, read(), write().
 */
export class BaseMirror {
  constructor() {
    this._subscribers = new Set();
  }

  /** Whether this mirror can be read from */
  get readable() {
    return false;
  }

  /** Whether this mirror can be written to */
  get writable() {
    return false;
  }

  /** Read current value (throws if not readable) */
  read() {
    throw new Error("Mirror is not readable");
  }

  /** Write a new value (throws if not writable) */
  write(value) {
    throw new Error("Mirror is not writable");
  }

  /**
   * Subscribe to value changes
   * @param {function} callback - Called with new value on each change
   * @returns {function} Unsubscribe function
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /** Notify all subscribers of a new value */
  _notify(value) {
    for (const cb of this._subscribers) {
      cb(value);
    }
  }

  /** Clean up resources */
  dispose() {
    this._subscribers.clear();
  }
}
