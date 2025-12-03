/**
 * BL/T - Bassline Text Protocol
 *
 * A simple line-based text format for Bassline interactions.
 *
 * Request format:  OPERATION ref [value] [@tag]
 * Response format: OK [value] [@tag] | ERROR code message | EVENT stream value
 *
 * Examples:
 *   READ bl:///cell/counter
 *   WRITE bl:///cell/counter 42
 *   OK 42
 *   ERROR 404 not found
 */

// Request operations
export const Op = {
  READ: 'READ',
  WRITE: 'WRITE',
  SUBSCRIBE: 'SUBSCRIBE',
  UNSUBSCRIBE: 'UNSUBSCRIBE',
  INFO: 'INFO',
  VERSION: 'VERSION',
  // Response operations
  OK: 'OK',
  ERROR: 'ERROR',
  EVENT: 'EVENT',
  STREAM: 'STREAM'
};

/**
 * Parse a BL/T message line
 *
 * @param {string} line - Single line message
 * @returns {object} Parsed message { op, ref?, value?, tag?, stream?, code?, message? }
 */
export function parse(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null; // Empty or comment
  }

  // Extract optional tag at the end
  let tag = null;
  let rest = trimmed;
  const tagMatch = rest.match(/\s+@(\S+)$/);
  if (tagMatch) {
    tag = tagMatch[1];
    rest = rest.slice(0, -tagMatch[0].length);
  }

  // Split into parts, respecting JSON values
  const parts = splitParts(rest);
  if (parts.length === 0) return null;

  const op = parts[0].toUpperCase();
  const msg = { op };
  if (tag) msg.tag = tag;

  switch (op) {
    case Op.READ:
    case Op.SUBSCRIBE:
    case Op.INFO:
      msg.ref = parts[1] || null;
      break;

    case Op.WRITE:
      msg.ref = parts[1] || null;
      msg.value = parts.length > 2 ? parseValue(parts.slice(2).join(' ')) : null;
      break;

    case Op.UNSUBSCRIBE:
      msg.stream = parts[1] || null;
      break;

    case Op.VERSION:
      msg.version = parts[1] || null;
      msg.formats = parts[2] ? parts[2].split(',') : null;
      break;

    case Op.OK:
      msg.value = parts.length > 1 ? parseValue(parts.slice(1).join(' ')) : null;
      break;

    case Op.ERROR:
      msg.code = parts[1] || null;
      msg.message = parts.slice(2).join(' ') || null;
      break;

    case Op.EVENT:
      msg.stream = parts[1] || null;
      msg.value = parts.length > 2 ? parseValue(parts.slice(2).join(' ')) : null;
      break;

    case Op.STREAM:
      msg.stream = parts[1] || null;
      break;

    default:
      msg.raw = rest;
  }

  return msg;
}

/**
 * Serialize a message to BL/T format
 *
 * @param {object} msg - Message object
 * @returns {string} BL/T line
 */
export function serialize(msg) {
  const parts = [msg.op];

  switch (msg.op) {
    case Op.READ:
    case Op.SUBSCRIBE:
    case Op.INFO:
      if (msg.ref) parts.push(msg.ref);
      break;

    case Op.WRITE:
      if (msg.ref) parts.push(msg.ref);
      if (msg.value !== undefined && msg.value !== null) {
        parts.push(serializeValue(msg.value));
      }
      break;

    case Op.UNSUBSCRIBE:
      if (msg.stream) parts.push(msg.stream);
      break;

    case Op.VERSION:
      if (msg.version) parts.push(msg.version);
      if (msg.formats) parts.push(msg.formats.join(','));
      break;

    case Op.OK:
      if (msg.value !== undefined && msg.value !== null) {
        parts.push(serializeValue(msg.value));
      }
      break;

    case Op.ERROR:
      if (msg.code) parts.push(msg.code);
      if (msg.message) parts.push(msg.message);
      break;

    case Op.EVENT:
      if (msg.stream) parts.push(msg.stream);
      if (msg.value !== undefined && msg.value !== null) {
        parts.push(serializeValue(msg.value));
      }
      break;

    case Op.STREAM:
      if (msg.stream) parts.push(msg.stream);
      break;
  }

  if (msg.tag) parts.push(`@${msg.tag}`);

  return parts.join(' ');
}

/**
 * Split a line into parts, respecting JSON objects/arrays
 */
function splitParts(line) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      current += char;
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') depth++;
      if (char === '}' || char === ']') depth--;

      if (char === ' ' && depth === 0) {
        if (current) {
          parts.push(current);
          current = '';
        }
        continue;
      }
    }

    current += char;
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Parse a value string into JS value
 */
function parseValue(str) {
  if (!str) return null;
  str = str.trim();

  // Try JSON first
  if (str.startsWith('{') || str.startsWith('[') || str.startsWith('"')) {
    try {
      return JSON.parse(str);
    } catch {
      // Fall through
    }
  }

  // Primitives
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (str === 'undefined') return undefined;

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  // Plain string
  return str;
}

/**
 * Serialize a JS value to string
 */
function serializeValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // Quote if contains spaces or special chars
    if (/[\s{}\[\]"]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  // Objects and arrays as JSON
  return JSON.stringify(value);
}

/**
 * Create a read request
 */
export function read(ref, tag) {
  return { op: Op.READ, ref, tag };
}

/**
 * Create a write request
 */
export function write(ref, value, tag) {
  return { op: Op.WRITE, ref, value, tag };
}

/**
 * Create a subscribe request
 */
export function subscribe(ref, tag) {
  return { op: Op.SUBSCRIBE, ref, tag };
}

/**
 * Create an info request
 */
export function info(ref, tag) {
  return { op: Op.INFO, ref, tag };
}

/**
 * Create an OK response
 */
export function ok(value, tag) {
  return { op: Op.OK, value, tag };
}

/**
 * Create an error response
 */
export function error(code, message, tag) {
  return { op: Op.ERROR, code, message, tag };
}

/**
 * Create an event message
 */
export function event(stream, value) {
  return { op: Op.EVENT, stream, value };
}
