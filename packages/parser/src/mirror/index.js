/**
 * Mirror System - Public API
 *
 * Provides Refs (URI-based resource identifiers) and Mirrors
 * (objects that provide access to those resources).
 *
 * URI format: bl:///[type]/[path]?[query]
 * Types are extensible via registry.registerType()
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
export { ActionMirror, action, registerAction } from './action.js';

// New Bassline mirrors
export { RegistryMirror, mountRegistryMirror } from './registry-mirror.js';
export {
  JsonSerializerMirror,
  mountJsonSerializer,
  serialize,
  deserialize,
  basslineReplacer,
  basslineReviver
} from './serialize-json.js';

// Re-export Ref from types
export { Ref, ref, isRef } from '../types.js';

// ============================================================================
// Type Handlers (for bl:// URIs)
// ============================================================================

import { Cell } from './cell.js';
import { Fold, reducers } from './fold.js';
import { RemoteMirror } from './remote.js';
import { actionTypeHandler, installBuiltinActions } from './action.js';
import { Ref } from '../types.js';
import { RefRegistry } from './registry.js';

/**
 * Cell type handler: bl:///cell/[name]?initial=[value]
 */
export function cellTypeHandler(subpath, ref, registry) {
  const store = registry.getStore('cells');

  if (!store.has(subpath)) {
    const initial = ref.searchParams.get('initial');
    const initialValue = initial !== null ? parseValue(initial) : undefined;
    store.set(subpath, new Cell(initialValue));
  }

  return store.get(subpath);
}

/**
 * Fold type handler: bl:///fold/[reducer]?sources=[refs]
 */
export function foldTypeHandler(subpath, ref, registry) {
  const reducerName = subpath;
  const reducer = reducers[reducerName];

  if (!reducer) {
    throw new Error(`Unknown fold reducer: ${reducerName}. Available: ${Object.keys(reducers).join(', ')}`);
  }

  const sourcesParam = ref.searchParams.get('sources');
  if (!sourcesParam) {
    throw new Error(`bl:///fold requires sources query param. Example: bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b`);
  }

  const sources = sourcesParam.split(',').map(s => new Ref(s.trim()));
  return new Fold(sources, reducer, registry);
}

/**
 * Remote type handler: bl:///remote/[peerName]?address=[ws://...]
 */
export function remoteTypeHandler(subpath, ref, registry) {
  const peerStore = registry.getStore('peers');
  const [peerName, ...remotePath] = subpath.split('/');

  // If just peer name with address, create/get the peer connection
  if (remotePath.length === 0) {
    const address = ref.searchParams.get('address');
    if (!peerStore.has(peerName) && address) {
      peerStore.set(peerName, new RemoteMirror(address));
    }
    return peerStore.get(peerName);
  }

  // Otherwise, would proxy to remote resource (future)
  const peer = peerStore.get(peerName);
  if (!peer) {
    throw new Error(`Unknown peer: ${peerName}. Define with bl:///remote/${peerName}?address=ws://...`);
  }
  // For now, return the peer itself
  // TODO: implement remote resource proxying
  return peer;
}

// ============================================================================
// bl:// Scheme Handler
// ============================================================================

/**
 * Main bl:// scheme handler - routes to type handlers based on path
 */
export function blSchemeHandler(ref, registry) {
  // bl:/// has empty hostname, path starts with /
  const pathParts = ref.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) {
    throw new Error('bl:// URI requires a type. Example: bl:///cell/counter');
  }

  const [type, ...rest] = pathParts;
  const subpath = rest.join('/');

  const handler = registry.getTypeHandler(type);
  if (!handler) {
    const registered = registry.listTypes();
    throw new Error(`Unknown bl:// type: ${type}. Registered: ${registered.join(', ') || 'none'}`);
  }

  return handler(subpath, ref, registry);
}

// ============================================================================
// Standard Scheme Handlers
// ============================================================================

/**
 * Handler for ws:// and wss:// schemes
 * Standard WebSocket URIs - meaning depends on registered middleware
 */
export function wsSchemeHandler(ref, registry) {
  return new RemoteMirror(ref.href);
}

// ============================================================================
// Registry Setup
// ============================================================================

/**
 * Install built-in types for bl:// URIs
 */
export function installBuiltinTypes(registry) {
  registry.registerType('cell', cellTypeHandler);
  registry.registerType('fold', foldTypeHandler);
  registry.registerType('remote', remoteTypeHandler);
  registry.registerType('action', actionTypeHandler);
  installBuiltinActions(registry);
}

/**
 * Install standard WebSocket scheme handlers
 */
export function installWsSchemes(registry) {
  registry.registerScheme('ws', wsSchemeHandler);
  registry.registerScheme('wss', wsSchemeHandler);
}

/**
 * Install bl:// scheme handler
 */
export function installBlScheme(registry) {
  registry.registerScheme('bl', blSchemeHandler);
}

/**
 * Create a registry with all built-in handlers
 */
export function createRegistry() {
  const registry = new RefRegistry();
  installBuiltinTypes(registry);
  installBlScheme(registry);
  installWsSchemes(registry);
  return registry;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a string value from query params
 */
function parseValue(str) {
  const num = Number(str);
  if (!isNaN(num)) return num;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return str;
}
