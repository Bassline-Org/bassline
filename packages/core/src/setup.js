/**
 * Bassline Setup
 *
 * Convenience setup for creating a fully-configured Bassline instance
 * with standard handlers mounted.
 *
 * @example
 * import { createBassline, ref } from '@bassline/core';
 *
 * const bl = createBassline();
 * bl.write(ref('bl:///cell/counter'), 42);
 * bl.read(ref('bl:///cell/counter')); // 42
 */

import { Bassline } from './bassline.js';
import {
  createCellHandler,
  createFoldHandler,
  createRemoteHandler,
  createActionHandler,
  builtinActions
} from './mirror/handlers.js';
import { RegistryMirror } from './mirror/registry-mirror.js';

// Re-export core types
export { Bassline } from './bassline.js';
export { ref, Ref, isRef, word, Word, isWord } from './types.js';

// Re-export mirrors
export { Cell, cell } from './mirror/cell.js';
export { Fold, fold, reducers } from './mirror/fold.js';
export { RemoteMirror, remote } from './mirror/remote.js';
export { BaseMirror, isMirror } from './mirror/interface.js';
export { RegistryMirror, mountRegistryMirror } from './mirror/registry-mirror.js';

// Re-export handlers
export {
  createCellHandler,
  createFoldHandler,
  createRemoteHandler,
  createActionHandler,
  builtinActions
} from './mirror/handlers.js';

// Re-export serialization
export {
  serializeValue,
  reviveValue,
  serializeMirror,
  deserializeMirror,
  registerMirrorType,
  toJSON,
  fromJSON
} from './mirror/serialize.js';

/**
 * Create a Bassline instance with standard handlers mounted.
 *
 * @param {Object} [options]
 * @param {Object} [options.actions] - Additional action handlers
 * @param {boolean} [options.includeBuiltinActions=true] - Include log, noop actions
 * @param {boolean} [options.includeRegistry=true] - Mount /registry introspection
 * @param {boolean} [options.includeCell=true] - Mount /cell handler
 * @param {boolean} [options.includeFold=true] - Mount /fold handler
 * @param {boolean} [options.includeRemote=true] - Mount /remote handler
 * @param {boolean} [options.includeAction=true] - Mount /action handler
 * @returns {Bassline}
 *
 * @example
 * // Basic usage
 * const bl = createBassline();
 *
 * @example
 * // With custom actions
 * const bl = createBassline({
 *   actions: {
 *     notify: (params, bl) => sendNotification(params.message)
 *   }
 * });
 * bl.write(ref('bl:///action/notify?message=Hello'));
 *
 * @example
 * // Minimal setup (no standard handlers)
 * const bl = createBassline({
 *   includeCell: false,
 *   includeFold: false,
 *   includeRemote: false,
 *   includeAction: false,
 *   includeRegistry: false
 * });
 */
export function createBassline(options = {}) {
  const bl = new Bassline();

  // Mount cell handler
  if (options.includeCell !== false) {
    bl.mount('/cell', createCellHandler());
  }

  // Mount fold handler
  if (options.includeFold !== false) {
    bl.mount('/fold', createFoldHandler());
  }

  // Mount remote handler
  if (options.includeRemote !== false) {
    bl.mount('/remote', createRemoteHandler());
  }

  // Mount action handler
  if (options.includeAction !== false) {
    const actions = options.includeBuiltinActions !== false
      ? { ...builtinActions, ...options.actions }
      : { ...options.actions };
    bl.mount('/action', createActionHandler(actions));
  }

  // Mount self-describing registry
  if (options.includeRegistry !== false) {
    bl.mount('/registry', new RegistryMirror(bl));
  }

  return bl;
}
