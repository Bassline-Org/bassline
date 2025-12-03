/**
 * Fold - A computed mirror that combines multiple source values
 *
 * Folds subscribe to their source mirrors and recompute
 * whenever any source changes.
 *
 * Used by the fold:// scheme handler.
 */

import { BaseMirror } from './interface.js';
import { Ref, isRef } from '../types.js';

export class Fold extends BaseMirror {
  /**
   * @param {Ref[]} sources - Source refs to fold
   * @param {function} reducer - (values: any[]) => any
   * @param {RefRegistry} registry - Registry to resolve source refs
   */
  constructor(sources, reducer, registry) {
    super();
    this._sources = sources;
    this._reducer = reducer;
    this._registry = registry;
    this._unsubscribes = [];
    this._cachedValue = undefined;

    this._subscribeToSources();
    this._recompute();
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
    for (const sourceRef of this._sources) {
      const mirror = this._registry.lookup(sourceRef);
      if (mirror) {
        const unsub = mirror.subscribe(() => this._recompute());
        this._unsubscribes.push(unsub);
      }
    }
  }

  _recompute() {
    const values = this._sources.map(ref => {
      const mirror = this._registry.lookup(ref);
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
export function fold(sources, reducer, registry) {
  return new Fold(sources, reducer, registry);
}
