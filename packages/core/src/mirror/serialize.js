/**
 * Value Serialization
 *
 * Handles serialization of special value types (Words, Refs).
 * Mirror serialization is handled by each Mirror's toJSON() method.
 * Mirror deserialization is handled by resolving the URI via middleware.
 */

import { word, isRef, isWord } from '../types.js';
import { isMirror } from './interface.js';

/**
 * Serialize a value for JSON storage
 *
 * - Word → { $word: "NAME" }
 * - Ref → href string
 * - Mirror → calls toJSON()
 * - Primitives → as-is
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

  return v;
}

/**
 * Revive a serialized value (Words only)
 *
 * Note: Mirrors are revived by resolving their URI via bassline.resolve()
 */
export function reviveValue(v) {
  if (v === null || v === undefined) {
    return v;
  }

  if (Array.isArray(v)) {
    return v.map(reviveValue);
  }

  if (typeof v === 'object') {
    if (v.$word !== undefined) {
      return word(v.$word);
    }

    // Regular object - recursively revive
    const result = {};
    for (const [key, val] of Object.entries(v)) {
      result[key] = reviveValue(val);
    }
    return result;
  }

  return v;
}
