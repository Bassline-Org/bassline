/**
 * Mirror Interface
 *
 * Mirrors are reflective objects that provide controlled access to resources.
 * Each mirror knows its ref and has access to the bassline system.
 *
 * Core interface: readable, writable, read(), write(), subscribe().
 */

/**
 * Check if an object implements the Mirror interface
 */
export function isMirror(obj) {
  return obj !== null &&
    typeof obj === 'object' &&
    typeof obj.read === 'function' &&
    typeof obj.write === 'function' &&
    typeof obj.subscribe === 'function';
}

/**
 * Base class for Mirror implementations
 *
 * Mirrors receive their ref and bassline in the constructor.
 * Subclasses override readable, writable, read(), write().
 */
export class BaseMirror {
  /**
   * @param {Ref} ref - The ref this mirror is bound to
   * @param {Bassline} bassline - The bassline system
   */
  constructor(ref, bassline) {
    this._ref = ref;
    this._bassline = bassline;
    this._subscribers = new Set();
  }

  /** The ref this mirror is bound to */
  get ref() {
    return this._ref;
  }

  /** The bassline system */
  get bassline() {
    return this._bassline;
  }

  /** Whether this mirror can be read from */
  get readable() {
    return true;
  }

  /** Whether this mirror can be written to */
  get writable() {
    return true;
  }

  /** Read current value */
  read() {
    throw new Error(`${this.constructor.name} does not implement read()`);
  }

  /** Write a new value */
  write(value) {
    throw new Error(`${this.constructor.name} does not implement write()`);
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

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Serialize this mirror to a JSON-compatible object
   *
   * Must return an object with { $mirror: type, ...config }
   * Subclasses must override this method.
   */
  toJSON() {
    throw new Error(`${this.constructor.name} does not implement toJSON()`);
  }

  /**
   * Static method to deserialize and reconstruct a mirror
   *
   * @param {object} data - Serialized data with $mirror field
   * @param {Ref} ref - The ref for this mirror
   * @param {Bassline} bassline - The bassline system
   * @returns {BaseMirror} Reconstructed mirror instance
   */
  static fromJSON(data, ref, bassline) {
    throw new Error(`${this.name} does not implement static fromJSON()`);
  }

  /**
   * Mirror type identifier for serialization
   *
   * Default: lowercase class name without "Mirror" suffix
   */
  static get mirrorType() {
    return this.name.toLowerCase().replace('mirror', '');
  }
}
