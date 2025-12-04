/**
 * SchemaMirror - Stores type/validation schemas
 *
 * Schemas describe the structure and constraints of data.
 * Uses JSON Schema-like format for familiarity.
 *
 * Usage:
 *   bl.write('bl:///schema/user', {
 *     type: 'object',
 *     properties: {
 *       name: { type: 'string', minLength: 1 },
 *       email: { type: 'string', format: 'email' }
 *     },
 *     required: ['name', 'email']
 *   });
 */

import { BaseMirror } from './interface.js';
import { serializeValue } from './serialize.js';

export class SchemaMirror extends BaseMirror {
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
    // Basic validation
    if (definition !== null && typeof definition === 'object') {
      if (!definition.type) {
        throw new Error('Schema definition must have a type');
      }
    }
    this._definition = definition;
    this._notify(definition);
  }

  static get mirrorType() {
    return 'schema';
  }

  toJSON() {
    return {
      $mirror: 'schema',
      uri: this._ref?.href,
      definition: serializeValue(this._definition)
    };
  }
}

/**
 * Create a Schema mirror (convenience function)
 */
export function schema(ref, bassline) {
  return new SchemaMirror(ref, bassline);
}
