/**
 * JSON Serialization Mirror
 *
 * Provides JSON serialization/deserialization as a resource.
 * Handles Bassline's special types: Word, Ref, Variable, Wildcard.
 *
 * URI:
 * - bl:///serialize/json?resource=<uri> - Serialize a resource to JSON
 *
 * Write:
 * - bl.write(ref('bl:///serialize/json'), { data, target }) - Deserialize into target
 *
 * JSON Format:
 * - Word: { "$word": "name" }
 * - Ref: { "$ref": "bl:///..." }
 * - Variable: { "$var": "x" }
 * - Wildcard: { "$wc": true }
 * - Primitives: native JSON (strings, numbers, booleans, null)
 */

import { BaseMirror } from './interface.js';
import { Word, word, Ref, ref, isRef, PatternVar, variable, WC, isWildcard } from '../types.js';

/**
 * JSON replacer for Bassline types
 */
export function basslineReplacer(key, value) {
  if (value instanceof Word) {
    // Word stores value in spelling Symbol's description
    return { $word: value.spelling.description };
  }
  if (isRef(value)) {
    return { $ref: value.href };
  }
  if (value instanceof PatternVar) {
    return { $var: value.name.description ?? value.name };
  }
  if (isWildcard(value)) {
    return { $wc: true };
  }
  return value;
}

/**
 * JSON reviver for Bassline types
 */
export function basslineReviver(key, value) {
  if (value && typeof value === 'object') {
    if (value.$word !== undefined) {
      return word(value.$word);
    }
    if (value.$ref !== undefined) {
      return ref(value.$ref);
    }
    if (value.$var !== undefined) {
      return variable(value.$var);
    }
    if (value.$wc === true) {
      return WC;
    }
  }
  return value;
}

/**
 * Serialize a value to JSON with Bassline type support
 */
export function serialize(value, pretty = false) {
  return JSON.stringify(value, basslineReplacer, pretty ? 2 : undefined);
}

/**
 * Deserialize JSON to a value with Bassline type support
 */
export function deserialize(json) {
  return JSON.parse(json, basslineReviver);
}

/**
 * JSON Serialization Mirror
 */
export class JsonSerializerMirror extends BaseMirror {
  constructor(bassline) {
    super();
    this._bassline = bassline;
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  /**
   * Read = serialize a resource
   *
   * Query params:
   * - resource: URI of resource to serialize
   * - pretty: if present, format with indentation
   */
  readRef(r, bassline) {
    const resourceUri = r.searchParams.get('resource');
    if (!resourceUri) {
      throw new Error('serialize/json requires ?resource=<uri> param');
    }

    const pretty = r.searchParams.has('pretty');
    const bl = bassline || this._bassline;

    // Read the resource
    const value = bl.read(ref(resourceUri));

    // Serialize to JSON
    return serialize(value, pretty);
  }

  /**
   * Write = deserialize JSON into a target
   *
   * Value: { data: string, target: string }
   */
  writeRef(r, value, bassline) {
    if (!value || typeof value.data !== 'string') {
      throw new Error('serialize/json write requires { data: string, target?: string }');
    }

    const { data, target } = value;
    const bl = bassline || this._bassline;

    // Deserialize
    const parsed = deserialize(data);

    // If target specified, write to it
    if (target) {
      bl.write(ref(target), parsed);
      return { deserialized: true, target };
    }

    // Otherwise just return the parsed value
    return parsed;
  }
}

/**
 * Mount the JSON serializer on a Bassline instance
 */
export function mountJsonSerializer(bassline) {
  const mirror = new JsonSerializerMirror(bassline);
  bassline.mount('/serialize/json', mirror);
  return mirror;
}
