/**
 * Mirror System - Public API
 *
 * Provides Refs (URI-based resource identifiers) and Mirrors
 * (objects that provide access to those resources).
 */

// Interface
export { isMirror, BaseMirror } from './interface.js';

// Registry
export {
  RefRegistry,
  getRegistry,
  setRegistry,
  resetRegistry
} from './registry.js';

// Mirror types
export { Cell, cell } from './cell.js';
export { Fold, fold, reducers } from './fold.js';
export { RemoteMirror, remote } from './remote.js';

// Re-export Ref from types
export { Ref, ref, isRef } from '../types.js';

// ============================================================================
// Built-in Scheme Handlers
// ============================================================================

import { Cell } from './cell.js';
import { Fold, reducers } from './fold.js';
import { RemoteMirror } from './remote.js';
import { Ref } from '../types.js';
import { RefRegistry } from './registry.js';

/**
 * Handler for local:// scheme
 *
 * Creates cells stored by path (hostname + pathname).
 * Example: local://counter → Cell at path "counter"
 * Example: local://counters/alice → Cell at path "counters/alice"
 */
export function localSchemeHandler(ref, registry) {
  const store = registry.getStore('local');
  // Use hostname + pathname as the full path
  const path = ref.hostname + ref.pathname;

  if (!store.has(path)) {
    // Check for initial value in query params
    const initial = ref.searchParams.get('initial');
    const initialValue = initial !== null ? parseValue(initial) : undefined;
    store.set(path, new Cell(initialValue));
  }

  return store.get(path);
}

/**
 * Handler for fold:// scheme
 *
 * Creates computed folds from source refs.
 * The hostname determines the reducer, query params specify sources.
 *
 * Example: fold://sum?sources=local://a,local://b
 *   - reducer: sum (from hostname)
 *   - sources: [Ref("local://a"), Ref("local://b")]
 */
export function foldSchemeHandler(ref, registry) {
  // Hostname is the reducer name (e.g., "sum", "max", "min")
  const reducerName = ref.hostname;
  const reducer = reducers[reducerName];

  if (!reducer) {
    throw new Error(`Unknown fold reducer: ${reducerName}. Available: ${Object.keys(reducers).join(', ')}`);
  }

  // Parse sources from query params
  const sourcesParam = ref.searchParams.get('sources');
  if (!sourcesParam) {
    throw new Error(`fold:// requires sources query param. Example: fold://sum?sources=local://a,local://b`);
  }

  const sources = sourcesParam.split(',').map(s => new Ref(s.trim()));

  return new Fold(sources, reducer, registry);
}

/**
 * Handler for ws:// and wss:// schemes
 *
 * Creates WebSocket connections.
 * Example: ws://localhost:8080/sync
 */
export function wsSchemeHandler(ref, registry) {
  return new RemoteMirror(ref.href);
}

/**
 * Install all built-in scheme handlers
 */
export function installBuiltinSchemes(registry) {
  registry.registerScheme('local', localSchemeHandler);
  registry.registerScheme('fold', foldSchemeHandler);
  registry.registerScheme('ws', wsSchemeHandler);
  registry.registerScheme('wss', wsSchemeHandler);
}

/**
 * Create a registry with built-in schemes installed
 */
export function createRegistry() {
  const registry = new RefRegistry();
  installBuiltinSchemes(registry);
  return registry;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a string value from query params
 */
function parseValue(str) {
  // Try number
  const num = Number(str);
  if (!isNaN(num)) return num;

  // Try boolean
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Return as string
  return str;
}
