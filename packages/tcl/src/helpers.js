// TCL interop helpers for converting between TCL and JS representations

export { parseList, formatList } from './libs/list.js'
export { parseDict, formatDict } from './libs/dict.js'

import { parseList, formatList } from './libs/list.js'
import { parseDict, formatDict } from './libs/dict.js'

/**
 * Convert a TCL dict string to a JS object
 * @param {string} str - TCL dict string like "key1 value1 key2 value2"
 * @returns {object} - JS object like {key1: "value1", key2: "value2"}
 */
export const tclDictToObject = str => {
  if (!str || typeof str !== 'string' || !str.trim()) {
    return {}
  }
  const map = parseDict(str)
  return Object.fromEntries(map)
}

/**
 * Convert a JS object to a TCL dict string
 * @param {object} obj - JS object
 * @returns {string} - TCL dict string
 */
export const objectToTclDict = obj => {
  if (!obj || typeof obj !== 'object') {
    return ''
  }
  return formatDict(new Map(Object.entries(obj)))
}

/**
 * Format a JS value as a TCL-safe string
 * Handles null, undefined, strings, numbers, booleans, arrays, and objects
 * @param {any} v - JS value
 * @returns {string} - TCL-formatted string
 */
export const formatValue = v => {
  if (v === null || v === undefined) return '{}'
  if (typeof v === 'string') {
    // Escape or brace the string appropriately
    if (v === '') return '{}'
    if (/[\s{}\\"]/.test(v) || v.includes('$') || v.includes('[')) {
      return `{${v}}`
    }
    return v
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return formatList(v.map(formatValue))
  if (typeof v === 'object') return objectToTclDict(v)
  return String(v)
}

/**
 * Format a resource response as a TCL dict with headers and body
 * @param {{headers: object, body: any}} response - Resource response
 * @returns {string} - TCL dict like "{headers {...} body ...}"
 */
export const formatTclResponse = ({ headers, body }) => {
  const h = objectToTclDict(headers || {})
  const b = formatValue(body)
  return `{headers {${h}} body ${b}}`
}

/**
 * Parse a TCL response dict back to JS object
 * @param {string} str - TCL dict string "{headers {...} body ...}"
 * @returns {{headers: object, body: string}} - Parsed response
 */
export const parseTclResponse = str => {
  const dict = tclDictToObject(str)
  return {
    headers: dict.headers ? tclDictToObject(dict.headers) : {},
    body: dict.body || '',
  }
}
