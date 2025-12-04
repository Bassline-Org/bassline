/**
 * CompoundMirror - A mirror for structures containing refs
 *
 * Compounds are values that contain refs to other resources.
 * They're stored as data (refs stay as $ref markers, not dereferenced).
 *
 * This is an explicit capability - without /compound middleware registered,
 * there's nothing at bl:///compound/... paths. This matches the sandboxing
 * model: middleware controls what's resolvable.
 *
 * Usage:
 *   bl.write('bl:///compound/user-bundle', {
 *     name: { $ref: 'bl:///cell/alice-name' },
 *     email: { $ref: 'bl:///cell/alice-email' }
 *   });
 *
 *   // Read returns definition (refs intact)
 *   bl.read('bl:///compound/user-bundle');
 *   // { name: { $ref: '...' }, email: { $ref: '...' } }
 */

import { BaseMirror } from './interface.js';
import { serializeValue } from './serialize.js';

export class CompoundMirror extends BaseMirror {
  /**
   * @param {Ref} ref - The ref this compound is bound to
   * @param {Bassline} bassline - The bassline system
   */
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
    this._definition = definition;
    this._notify(definition);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  static get mirrorType() {
    return 'compound';
  }

  toJSON() {
    return {
      $mirror: 'compound',
      uri: this._ref?.href,
      definition: serializeValue(this._definition)
    };
  }
}

/**
 * Create a Compound mirror (convenience function for tests)
 * Note: In normal usage, compounds are created via middleware resolution
 */
export function compound(ref, bassline) {
  return new CompoundMirror(ref, bassline);
}
