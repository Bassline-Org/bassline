/**
 * Fold Mirrors - Computed values from sources
 *
 * Each fold is an explicit class. Sources come from ref query params:
 *   bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b
 *
 * Folds subscribe to their sources and recompute when any changes.
 */

import { BaseMirror } from './interface.js';
import { ref } from '../types.js';

// ============================================================================
// Base Fold Class
// ============================================================================

/**
 * Base class for all fold mirrors
 */
class BaseFold extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
    const sourcesParam = r.searchParams.get('sources');
    this._sourceRefs = sourcesParam
      ? sourcesParam.split(',').map(s => ref(s.trim()))
      : [];
    this._unsubscribes = [];
    this._cachedValue = undefined;

    // Subscribe to sources and compute initial value
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

  write() {
    throw new Error('Folds are not writable');
  }

  /**
   * Override in subclass: compute value from source values
   */
  _reduce(values) {
    throw new Error(`${this.constructor.name} must implement _reduce()`);
  }

  _subscribeToSources() {
    for (const sourceRef of this._sourceRefs) {
      try {
        const unsub = this._bassline.watch(sourceRef, () => this._recompute());
        this._unsubscribes.push(unsub);
      } catch (e) {
        // Source might not exist yet - that's ok
      }
    }
  }

  _recompute() {
    const values = this._sourceRefs.map(sourceRef => {
      try {
        return this._bassline.read(sourceRef);
      } catch (e) {
        return undefined;
      }
    });

    const definedValues = values.filter(v => v !== undefined);
    const newValue = this._reduce(definedValues);

    if (newValue !== this._cachedValue) {
      this._cachedValue = newValue;
      this._notify(this._cachedValue);
    }
  }

  dispose() {
    for (const unsub of this._unsubscribes) {
      unsub();
    }
    this._unsubscribes = [];
    super.dispose();
  }

  toJSON() {
    return {
      $mirror: this.constructor.mirrorType,
      uri: this._ref?.href
    };
  }
}

// ============================================================================
// Explicit Fold Classes
// ============================================================================

export class SumFold extends BaseFold {
  static get mirrorType() { return 'sum'; }
  _reduce(values) { return values.reduce((a, b) => a + b, 0); }
}

export class MaxFold extends BaseFold {
  static get mirrorType() { return 'max'; }
  _reduce(values) { return values.length > 0 ? Math.max(...values) : undefined; }
}

export class MinFold extends BaseFold {
  static get mirrorType() { return 'min'; }
  _reduce(values) { return values.length > 0 ? Math.min(...values) : undefined; }
}

export class AvgFold extends BaseFold {
  static get mirrorType() { return 'avg'; }
  _reduce(values) {
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : undefined;
  }
}

export class CountFold extends BaseFold {
  static get mirrorType() { return 'count'; }
  _reduce(values) { return values.length; }
}

export class FirstFold extends BaseFold {
  static get mirrorType() { return 'first'; }
  _reduce(values) { return values[0]; }
}

export class LastFold extends BaseFold {
  static get mirrorType() { return 'last'; }
  _reduce(values) { return values[values.length - 1]; }
}

export class ConcatFold extends BaseFold {
  static get mirrorType() { return 'concat'; }
  _reduce(values) { return values.join(''); }
}

export class ListFold extends BaseFold {
  static get mirrorType() { return 'list'; }
  _reduce(values) { return [...values]; }
}
