/**
 * Typed value system for Bassline
 *
 * Distinguishes between:
 * - Words: Normalized identifiers (case-insensitive symbols)
 * - Refs: URI references to resources
 * - Strings: Case-sensitive literals
 * - Numbers: Numeric values
 */

/**
 * Normalize a key to uppercase for case-insensitive lookups
 */
export function normalize(key) {
  if (typeof key === "symbol") {
    return key.description.toUpperCase();
  }
  return key.toUpperCase();
}

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
    return `${this.spelling.description}`;
  }
}

/**
 * Ref - URI reference to an external resource
 *
 * Refs are URIs that identify resources managed by Mirrors.
 * The URI is self-describing - the scheme determines how to resolve it.
 *
 * Examples:
 *   new Ref("bl:///cell/counter")        // Local cell
 *   new Ref("bl:///fold/sum?sources=...") // Computed fold
 *   new Ref("ws://localhost:8080")        // WebSocket connection
 */
export class Ref {
  constructor(uriString) {
    if (typeof uriString !== "string") {
      throw new Error(`Ref requires string URI, got: ${typeof uriString}`);
    }

    // Use Node's built-in URL for parsing and validation
    try {
      this._url = new URL(uriString);
    } catch (e) {
      throw new Error(`Invalid URI: ${uriString} - ${e.message}`);
    }
    
    this._href = this._url.href;
  }

  /** URI scheme (e.g., "bl", "ws", "wss") */
  get scheme() {
    return this._url.protocol.slice(0, -1); // Remove trailing ':'
  }

  /** Host portion (e.g., "localhost:8080") */
  get host() {
    return this._url.host;
  }

  /** Hostname without port */
  get hostname() {
    return this._url.hostname;
  }

  /** Port number as string */
  get port() {
    return this._url.port;
  }

  /** Path portion (e.g., "/cell/counter") */
  get pathname() {
    return this._url.pathname;
  }

  /** Query string including ? (e.g., "?sources=a,b") */
  get search() {
    return this._url.search;
  }

  /** URLSearchParams for query string access */
  get searchParams() {
    return this._url.searchParams;
  }

  /** Canonical URI string */
  get href() {
    return this._href;
  }

  /** The underlying URL object */
  get url() {
    return this._url;
  }

  toString() {
    return this._href;
  }
}

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
 * Create a ref from a URI string
 */
export function ref(uri) {
  return new Ref(uri);
}

// ============================================================================
// Type Checks
// ============================================================================

export function isWord(value) {
  return value instanceof Word;
}

export function isString(value) {
  return typeof value === "string";
}

export function isNumber(value) {
  return typeof value === "number";
}

export function isRef(value) {
  return value instanceof Ref;
}

/**
 * Check if value is a valid type
 */
export function isValidType(value) {
  return isWord(value) ||
    isRef(value) ||
    isString(value) ||
    isNumber(value);
}

/**
 * Validate value or throw error
 */
export function validateType(value, usage = "Value") {
  if (!isValidType(value)) {
    throw new Error(
      `${usage} must be Word, Ref, string, or number. Got: ${typeof value} ${value}`,
    );
  }
  return value;
}

/**
 * Check if two typed values are equal
 */
export function valuesEqual(a, b) {
  validateType(a, "a in valuesEqual");
  validateType(b, "b in valuesEqual");

  // Words compare by spelling symbol
  if (isWord(a) && isWord(b)) {
    return a.spelling === b.spelling;
  }

  // Refs compare by canonical href
  if (isRef(a) && isRef(b)) {
    return a.href === b.href;
  }

  // Primitives use === (strings, numbers)
  return a === b;
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
 *     ref: (href) => `Ref: ${href}`
 *   })
 */
export function match(value, handlers) {
  if (value instanceof Word) {
    if (!handlers.word) {
      throw new Error("No handler for Word type");
    }
    return handlers.word(value.spelling.description);
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

  if (value instanceof Ref) {
    if (!handlers.ref) {
      throw new Error("No handler for Ref type");
    }
    return handlers.ref(value.href);
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
 *   Word("ALICE")     → "ALICE"
 *   "hello"           → "\"hello\""
 *   42                → "42"
 *   Ref(...)          → "<uri>"
 */
export function serialize(value) {
  return match(value, {
    word: (spelling) => spelling.toString(),
    string: (str) => `"${str}"`,
    number: (num) => num.toString(),
    ref: (href) => `<${href}>`,
  });
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
