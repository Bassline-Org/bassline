/**
 * Mirror System - Public API
 *
 * Mirrors are reflective objects that provide controlled reification
 * and intercession for resources identified by URIs.
 */

// Interface
export { isMirror, BaseMirror } from './interface.js';

// Mirror types
export { Cell, cell } from './cell.js';
export { Fold, fold, reducers } from './fold.js';
export { RemoteMirror, remote } from './remote.js';

// Registry mirror (self-describing namespace)
export { RegistryMirror, mountRegistryMirror } from './registry-mirror.js';

// Handler factories
export {
  createCellHandler,
  createFoldHandler,
  createRemoteHandler,
  createActionHandler,
  builtinActions
} from './handlers.js';

// Serialization
export {
  serializeValue,
  reviveValue,
  serializeMirror,
  deserializeMirror,
  registerMirrorType,
  getMirrorDeserializer,
  toJSON,
  fromJSON
} from './serialize.js';

// Re-export Ref from types
export { Ref, ref, isRef } from '../types.js';
