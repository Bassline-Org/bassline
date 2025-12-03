/**
 * Mirror Serialization
 *
 * Provides serialization/deserialization for Mirror instances.
 * Each Mirror type owns its own serialization via toJSON()/fromJSON().
 *
 * Value serialization rules:
 * - Refs → URI string (refs are static data)
 * - Words → { $word: "NAME" } (tagged for special semantics)
 * - Primitives → inline JSON as-is
 * - Mirrors → { $mirror: type, ...config }
 */

import { Word, word, Ref, ref, isRef, isWord } from '../types.js';
import { isMirror } from './interface.js';

// ============================================================================
// Value Serialization
// ============================================================================

/**
 * Serialize a value for JSON storage
 *
 * - Word → { $word: "NAME" }
 * - Ref → href string
 * - Primitives → as-is
 * - Objects/Arrays → recursively serialize values
 */
export function serializeValue(v) {
  if (v === null || v === undefined) {
    return v;
  }

  if (isWord(v)) {
    return { $word: v.spelling.description };
  }

  if (isRef(v)) {
    return v.href;
  }

  if (isMirror(v)) {
    return v.toJSON();
  }

  if (Array.isArray(v)) {
    return v.map(serializeValue);
  }

  if (typeof v === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(v)) {
      result[key] = serializeValue(val);
    }
    return result;
  }

  // Primitives (string, number, boolean)
  return v;
}

/**
 * Revive a serialized value
 *
 * - { $word: "NAME" } → Word
 * - { $mirror: type, ... } → defer to deserializeMirror
 * - Other objects/arrays → recursively revive
 * - Primitives → as-is
 *
 * Note: URI strings are NOT automatically converted to Refs.
 * The caller decides when to interpret a string as a Ref.
 */
export function reviveValue(v, registry = null) {
  if (v === null || v === undefined) {
    return v;
  }

  if (Array.isArray(v)) {
    return v.map(item => reviveValue(item, registry));
  }

  if (typeof v === 'object') {
    // Check for tagged types
    if (v.$word !== undefined) {
      return word(v.$word);
    }

    if (v.$mirror !== undefined) {
      return deserializeMirror(v, registry);
    }

    // Regular object - recursively revive
    const result = {};
    for (const [key, val] of Object.entries(v)) {
      result[key] = reviveValue(val, registry);
    }
    return result;
  }

  // Primitives (string, number, boolean)
  return v;
}

// ============================================================================
// Mirror Type Registry
// ============================================================================

const mirrorDeserializers = new Map();

/**
 * Register a deserializer for a mirror type
 *
 * @param {string} type - The $mirror type identifier (e.g., "cell", "fold")
 * @param {function} fromJSON - Static fromJSON method: (data, registry) => Mirror
 */
export function registerMirrorType(type, fromJSON) {
  mirrorDeserializers.set(type, fromJSON);
}

/**
 * Get the deserializer for a mirror type
 */
export function getMirrorDeserializer(type) {
  return mirrorDeserializers.get(type);
}

// ============================================================================
// Mirror Serialization
// ============================================================================

/**
 * Serialize a mirror to JSON-compatible object
 *
 * Calls the mirror's toJSON() method.
 */
export function serializeMirror(mirror) {
  if (!isMirror(mirror)) {
    throw new Error('serializeMirror requires a Mirror instance');
  }
  return mirror.toJSON();
}

/**
 * Deserialize a mirror from JSON data
 *
 * @param {object} data - Serialized data with $mirror type
 * @param {object} registry - Registry for resolving refs and caching mirrors
 * @returns {Mirror} Reconstructed mirror instance
 */
export function deserializeMirror(data, registry = null) {
  if (!data || typeof data !== 'object') {
    throw new Error('deserializeMirror requires an object');
  }

  const type = data.$mirror;
  if (type === undefined) {
    throw new Error('deserializeMirror requires $mirror type field');
  }

  const deserializer = mirrorDeserializers.get(type);
  if (!deserializer) {
    throw new Error(`Unknown mirror type: ${type}`);
  }

  return deserializer(data, registry);
}

/**
 * Install built-in mirror type deserializers
 *
 * Call this after importing all mirror types to register them.
 */
export function installBuiltinMirrors() {
  // Lazy import to avoid circular dependencies
  // These will be registered when each mirror type is imported
}

// ============================================================================
// JSON Stringify/Parse Helpers
// ============================================================================

/**
 * Serialize a value or mirror to JSON string
 */
export function toJSON(value, pretty = false) {
  const serialized = isMirror(value) ? serializeMirror(value) : serializeValue(value);
  return JSON.stringify(serialized, null, pretty ? 2 : undefined);
}

/**
 * Parse JSON string and revive values/mirrors
 */
export function fromJSON(json, registry = null) {
  const data = JSON.parse(json);
  return reviveValue(data, registry);
}
