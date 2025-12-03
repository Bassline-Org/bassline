/**
 * Fold - A computed mirror that combines multiple source values
 *
 * Folds subscribe to their source mirrors and recompute
 * whenever any source changes.
 */

import { BaseMirror } from './interface.js';
import { Ref, ref, isRef } from '../types.js';
import { registerMirrorType } from './serialize.js';

export class Fold extends BaseMirror {
  /**
   * @param {Ref[]} sources - Source refs to fold
   * @param {function} reducer - (values: any[]) => any
   * @param {object} [options] - Configuration
   * @param {string} [options.reducerName] - Name of the reducer (for serialization)
   * @param {string} [options.uri] - Optional URI for this fold
   * @param {Bassline} [options.bassline] - Bassline instance (optional, can be set later via setBassline)
   */
  constructor(sources, reducer, options = {}) {
    super();
    this._sources = sources;
    this._reducer = reducer;
    this._reducerName = options.reducerName || findReducerName(reducer);
    this._uri = options.uri || null;
    this._unsubscribes = [];
    this._cachedValue = undefined;
    this._initialized = false;

    // If bassline provided, set it now (triggers initialization)
    if (options.bassline) {
      this.setBassline(options.bassline);
    }
  }

  /**
   * Override setBassline to initialize subscriptions when mounted
   */
  setBassline(bassline) {
    super.setBassline(bassline);
    if (!this._initialized) {
      this._subscribeToSources();
      this._recompute();
      this._initialized = true;
    }
  }

  get readable() {
    return true;
  }

  get writable() {
    return false;
  }

  read() {
    return this._cachedValue;
  }

  _subscribeToSources() {
    const bl = this._requireBassline('subscribe to sources');

    for (const sourceRef of this._sources) {
      const mirror = bl.getMirror(sourceRef);
      if (mirror && mirror.subscribe) {
        const unsub = mirror.subscribe(() => this._recompute());
        this._unsubscribes.push(unsub);
      }
    }
  }

  _recompute() {
    if (!this._bassline) return; // Not mounted yet

    const values = this._sources.map(sourceRef => {
      const mirror = this._bassline.getMirror(sourceRef);
      return mirror?.readable ? mirror.read() : undefined;
    });

    // Filter out undefined values for fold computation
    const definedValues = values.filter(v => v !== undefined);
    this._cachedValue = this._reducer(definedValues);
    this._notify(this._cachedValue);
  }

  dispose() {
    for (const unsub of this._unsubscribes) {
      unsub();
    }
    this._unsubscribes = [];
    super.dispose();
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  static get mirrorType() {
    return 'fold';
  }

  toJSON() {
    return {
      $mirror: 'fold',
      uri: this._uri,
      sources: this._sources.map(s => s.href),
      reducer: this._reducerName
    };
  }

  static fromJSON(data, bassline = null) {
    const sources = data.sources.map(uri => ref(uri));
    const reducer = reducers[data.reducer];
    if (!reducer) {
      throw new Error(`Unknown reducer: ${data.reducer}`);
    }
    return new Fold(sources, reducer, {
      reducerName: data.reducer,
      uri: data.uri,
      bassline
    });
  }
}

// ============================================================================
// Built-in Reducers
// ============================================================================

export const reducers = {
  sum: (values) => values.reduce((a, b) => a + b, 0),
  max: (values) => values.length > 0 ? Math.max(...values) : undefined,
  min: (values) => values.length > 0 ? Math.min(...values) : undefined,
  avg: (values) => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : undefined,
  count: (values) => values.length,
  first: (values) => values[0],
  last: (values) => values[values.length - 1],
  concat: (values) => values.join(''),
  list: (values) => [...values],
};

/**
 * Create a fold from source refs
 */
export function fold(sources, reducer, options = {}) {
  return new Fold(sources, reducer, options);
}

/**
 * Find the name of a reducer function
 */
function findReducerName(fn) {
  for (const [name, reducer] of Object.entries(reducers)) {
    if (reducer === fn) return name;
  }
  return null;
}

// Register with serialization system
registerMirrorType('fold', Fold.fromJSON);
