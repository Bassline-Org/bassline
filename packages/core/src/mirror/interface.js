/**
 * Mirror Interface
 *
 * Mirrors provide access to resources identified by Refs.
 * Core interface: readable, writable, read(), write(), subscribe().
 * Middleware hooks: onInsert(), onTrigger().
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
    this._bassline = null;
  }

  // ============================================================================
  // Bassline Association
  // ============================================================================

  /**
   * Set the Bassline instance this mirror is mounted on.
   * Called automatically by Bassline.mount().
   *
   * @param {Bassline} bassline - The Bassline instance
   */
  setBassline(bassline) {
    this._bassline = bassline;
  }

  /**
   * Get the Bassline instance, throwing if not mounted.
   * Helper for subclasses that need to resolve refs.
   *
   * @param {string} operation - Description of what operation needs bassline
   * @returns {Bassline}
   */
  _requireBassline(operation = 'this operation') {
    if (!this._bassline) {
      throw new Error(`Mirror must be mounted to perform ${operation}`);
    }
    return this._bassline;
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

  // ============================================================================
  // Middleware Hooks
  // ============================================================================

  /**
   * Called when this ref appears in a quad being inserted (middleware hook)
   *
   * The mirror receives the full quad and can:
   * - Perform side effects (fire-and-forget)
   * - Return false to block the insert
   * - Return true to allow the insert
   *
   * Multiple handlers can process the same quad (middleware pattern).
   *
   * @param {Quad} quad - The quad being inserted
   * @param {Graph} graph - The graph receiving the insert
   * @returns {boolean} - Return false to block insert
   */
  onInsert(quad, graph) {
    return true; // Default: allow insert
  }

  /**
   * Called when this ref is inserted standalone (not as part of a quad)
   *
   * Used for action triggers - the ref itself is the invocation.
   * Parameters come from the URI query string.
   *
   * @param {Graph} graph - The graph
   * @param {Ref} ref - The ref being triggered (contains params in searchParams)
   */
  onTrigger(graph, ref) {
    // Default: do nothing
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
   * Merge serialized data into this mirror
   *
   * Used for sync scenarios where a mirror already exists.
   * Default implementation does nothing - subclasses override as needed.
   *
   * @param {object} data - Serialized data (without $mirror marker)
   */
  merge(data) {
    // Default: no-op
  }

  /**
   * Static method to deserialize and reconstruct a mirror
   *
   * Subclasses must implement this to support deserialization.
   *
   * @param {object} data - Serialized data with $mirror field
   * @param {object} registry - Registry for resolving refs
   * @returns {BaseMirror} Reconstructed mirror instance
   */
  static fromJSON(data, registry) {
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
