/**
 * Compound Structure Utilities
 *
 * Helpers for working with structures that contain refs.
 * Refs are data - these utilities help you navigate and work with them.
 */

import { ref as makeRef, isRef, Ref } from './types.js';

/**
 * Check if a value is a ref marker object ({ $ref: "..." })
 * @param {*} value
 * @returns {boolean}
 */
export function isRefMarker(value) {
  return value !== null &&
    typeof value === 'object' &&
    typeof value.$ref === 'string';
}

/**
 * Navigate into a structure by path
 * Returns the value at that path (could be a ref marker, nested object, or primitive)
 *
 * @param {*} structure - The structure to navigate
 * @param {string|string[]} path - Path like "user.name" or ["user", "name"]
 * @returns {*} Value at path, or undefined if not found
 */
export function getPath(structure, path) {
  const parts = typeof path === 'string' ? path.split('.') : path;
  let current = structure;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Get the Ref at a path (if the value at that path is a ref marker)
 *
 * @param {*} structure - The structure to navigate
 * @param {string|string[]} path - Path to navigate
 * @returns {Ref|null} The Ref at that path, or null if not a ref
 */
export function getRefAt(structure, path) {
  const value = getPath(structure, path);

  if (isRefMarker(value)) {
    return makeRef(value.$ref);
  }

  if (isRef(value)) {
    return value;
  }

  return null;
}

/**
 * Collect all refs in a structure (recursive)
 *
 * @param {*} structure - The structure to search
 * @returns {Ref[]} All refs found in the structure
 */
export function collectRefs(structure) {
  const refs = [];

  function walk(value) {
    if (value === null || value === undefined) return;

    if (isRef(value)) {
      refs.push(value);
      return;
    }

    if (isRefMarker(value)) {
      refs.push(makeRef(value.$ref));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  }

  walk(structure);
  return refs;
}

/**
 * Convert ref markers to Ref objects in a structure (recursive)
 *
 * @param {*} value - Value possibly containing $ref markers
 * @returns {*} Value with markers converted to Ref objects
 */
export function reviveRefs(value) {
  if (value === null || value === undefined) return value;

  if (isRefMarker(value)) {
    return makeRef(value.$ref);
  }

  if (Array.isArray(value)) {
    return value.map(reviveRefs);
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = reviveRefs(v);
    }
    return result;
  }

  return value;
}

/**
 * Set a value at a path in a structure (immutable - returns new structure)
 *
 * @param {*} structure - The structure to modify
 * @param {string|string[]} path - Path to set
 * @param {*} value - Value to set at path
 * @returns {*} New structure with value set at path
 */
export function setPath(structure, path, value) {
  const parts = typeof path === 'string' ? path.split('.') : path;

  if (parts.length === 0) {
    return value;
  }

  const [head, ...tail] = parts;
  const current = structure ?? {};

  return {
    ...current,
    [head]: tail.length === 0 ? value : setPath(current[head], tail, value)
  };
}
