/**
 * Typed value system for Bassline
 *
 * Distinguishes between:
 * - Words: Normalized identifiers (case-insensitive symbols)
 * - Strings: Case-sensitive literals
 * - Numbers: Numeric values
 * - Pattern variables: Universal matchers that bind values
 * - Wildcards: Universal matchers that don't bind
 */

import { normalize } from "./helpers.js";

/**
 * Word - Normalized identifier/symbol
 *
 * Words are case-insensitive and whitespace-trimmed.
 * Internally represented as interned symbols for fast comparison.
 *
 * Examples:
 *   new Word("alice") === new Word("ALICE")  // true
 *   new Word("alice") === new Word("bob")    // false
 */
export class Word {
  constructor(str) {
    if (typeof str !== "string") {
      throw new Error(`Word requires string, got: ${typeof str}`);
    }
    // Normalize to uppercase and intern as symbol for O(1) comparison
    this.spelling = Symbol.for(normalize(str.trim()));
  }

  toString() {
    return `Word(${this.spelling.description})`;
  }
}

/**
 * PatternVar - Pattern variable that matches and binds any value
 *
 * Pattern variables are case-insensitive like words.
 * They match any value type and bind the matched value.
 *
 * Examples:
 *   new PatternVar("x") matches new Word("alice") → binds {?X => new Word("alice")}
 *   new PatternVar("x") matches "hello"           → binds {?X => "hello"}
 *   new PatternVar("x") matches 42                → binds {?X => 42}
 */
export class PatternVar {
  constructor(name) {
    if (typeof name !== "string") {
      throw new Error(`PatternVar requires string, got: ${typeof name}`);
    }
    // Normalize variable name
    this.name = Symbol.for(normalize(name));
  }

  toString() {
    return `?${this.name.description}`;
  }
}

/**
 * Wildcard - Universal matcher that doesn't bind
 *
 * Wildcards match any value but don't create bindings.
 * Singleton instance exported as WC constant.
 */
export class Wildcard {
  toString() {
    return "*";
  }
}

/**
 * Wildcard singleton
 */
export const WC = new Wildcard();

// ============================================================================
// Type Constructors (User-facing API)
// ============================================================================

/**
 * Create a word from a string
 */
export function word(str) {
  return new Word(str);
}

/**
 * Create a pattern variable from a name
 */
export function variable(name) {
  return new PatternVar(name);
}

// ============================================================================
// Type Checks
// ============================================================================

export function isWord(value) {
  return value instanceof Word;
}

export function isPatternVar(value) {
  return value instanceof PatternVar;
}

export function isWildcard(value) {
  return value instanceof Wildcard;
}

export function isString(value) {
  return typeof value === "string";
}

export function isNumber(value) {
  return typeof value === "number";
}

/**
 * Check if value is a valid graph value type
 */
export function isValidType(value) {
  return isWord(value) ||
    isPatternVar(value) ||
    isWildcard(value) ||
    isString(value) ||
    isNumber(value);
}

/**
 * Validate value or throw error
 */
export function validateType(value, usage = "Value") {
  if (!isValidType(value)) {
    throw new Error(
      `${usage} must be Word, PatternVar, Wildcard, string, or number. Got: ${typeof value} ${value}`,
    );
  }
  return value;
}

// ============================================================================
// Multi-method Dispatch (For library code)
// ============================================================================

/**
 * Multi-method dispatch based on value type
 *
 * Usage:
 *   match(value, {
 *     word: (spelling) => `Word: ${spelling}`,
 *     string: (str) => `String: ${str}`,
 *     number: (num) => `Number: ${num}`,
 *     variable: (name) => `Var: ${name}`,
 *     wildcard: () => 'Wildcard'
 *   })
 */
export function match(value, handlers) {
  if (value instanceof Word) {
    if (!handlers.word) {
      throw new Error("No handler for Word type");
    }
    return handlers.word(value.spelling.description);
  }

  if (value instanceof PatternVar) {
    if (!handlers.variable) {
      throw new Error("No handler for PatternVar type");
    }
    return handlers.variable(value.name.description);
  }

  if (value instanceof Wildcard) {
    if (!handlers.wildcard) {
      throw new Error("No handler for Wildcard type");
    }
    return handlers.wildcard();
  }

  if (typeof value === "string") {
    if (!handlers.string) {
      throw new Error("No handler for string type");
    }
    return handlers.string(value);
  }

  if (typeof value === "number") {
    if (!handlers.number) {
      throw new Error("No handler for number type");
    }
    return handlers.number(value);
  }

  throw new Error(`Invalid value type: ${value}`);
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize typed value to string format
 *
 * Format:
 *   Word("ALICE")     → "w:ALICE"
 *   "hello"           → "s:hello"
 *   42                → "n:42"
 *   PatternVar("X")   → "v:X"
 *   Wildcard          → "_"
 */
export function serialize(value) {
  return match(value, {
    word: (spelling) => `w:${spelling}`,
    string: (str) => `s:${str}`,
    number: (num) => `n:${num}`,
    variable: (name) => `v:${name}`,
    wildcard: () => "_",
  });
}

/**
 * Deserialize string to typed value
 */
export function deserialize(str) {
  if (typeof str !== "string") {
    throw new Error(`Cannot deserialize non-string: ${typeof str}`);
  }

  if (str.startsWith("w:")) {
    return new Word(str.slice(2));
  }

  if (str.startsWith("s:")) {
    return str.slice(2);
  }

  if (str.startsWith("n:")) {
    return Number(str.slice(2));
  }

  if (str.startsWith("v:")) {
    return new PatternVar(str.slice(2));
  }

  if (str === "_") {
    return WC;
  }

  throw new Error(`Invalid serialized value: ${str}`);
}

/**
 * Compute the 32-bit FNV-1a hash of a string
 * @param {string} str
 * @returns {number} 32-bit unsigned hash
 */
export function fnv1aHash(str) {
  if (typeof str !== "string") {
    throw new Error(`Cannot hash non-string: ${typeof str}`);
  }
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime
  }
  return hash;
}

export function hash(value) {
  return fnv1aHash(serialize(value));
}
