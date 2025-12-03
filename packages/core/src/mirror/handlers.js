/**
 * Handler Factories
 *
 * Factory functions that create handlers for standard resource types.
 * These replace the type handlers from the old RefRegistry.
 *
 * Usage:
 *   const bl = new Bassline();
 *   bl.mount('/cell', createCellHandler());
 *   bl.mount('/fold', createFoldHandler());
 */

import { Cell } from './cell.js';
import { Fold, reducers } from './fold.js';
import { RemoteMirror } from './remote.js';
import { Ref } from '../types.js';

// ============================================================================
// Cell Handler
// ============================================================================

/**
 * Create a handler for cells.
 * Creates cells on demand based on subpath.
 *
 * @returns {function} Handler function for mounting at /cell
 *
 * @example
 * bl.mount('/cell', createCellHandler());
 * bl.write('bl:///cell/counter', 42);
 * bl.read('bl:///cell/counter'); // 42
 */
export function createCellHandler() {
  const store = new Map();

  return function cellHandler(subpath, ref, bassline) {
    if (!store.has(subpath)) {
      const initial = ref.searchParams.get('initial');
      const initialValue = initial !== null ? parseValue(initial) : undefined;
      const cell = new Cell(initialValue);
      cell.setBassline(bassline);
      store.set(subpath, cell);
    }
    return store.get(subpath);
  };
}

// ============================================================================
// Fold Handler
// ============================================================================

/**
 * Create a handler for folds.
 * Folds are computed values from multiple sources.
 *
 * @returns {function} Handler function for mounting at /fold
 *
 * @example
 * bl.mount('/fold', createFoldHandler());
 * bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
 */
export function createFoldHandler() {
  return function foldHandler(subpath, ref, bassline) {
    const reducerName = subpath;
    const reducer = reducers[reducerName];

    if (!reducer) {
      const available = Object.keys(reducers).join(', ');
      throw new Error(`Unknown fold reducer: ${reducerName}. Available: ${available}`);
    }

    const sourcesParam = ref.searchParams.get('sources');
    if (!sourcesParam) {
      throw new Error(`Fold requires sources query param. Example: bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b`);
    }

    const sources = sourcesParam.split(',').map(s => new Ref(s.trim()));
    return new Fold(sources, reducer, { reducerName, bassline });
  };
}

// ============================================================================
// Remote Handler
// ============================================================================

/**
 * Create a handler for remote peers.
 * Manages WebSocket connections to remote Bassline instances.
 *
 * @returns {function} Handler function for mounting at /remote
 *
 * @example
 * bl.mount('/remote', createRemoteHandler());
 * bl.read('bl:///remote/peer1?address=ws://localhost:8080');
 */
export function createRemoteHandler() {
  const store = new Map();

  return function remoteHandler(subpath, ref, bassline) {
    const [peerName, ...remotePath] = subpath.split('/');
    const address = ref.searchParams.get('address');

    if (!store.has(peerName) && address) {
      const remote = new RemoteMirror(address);
      remote.setBassline(bassline);
      store.set(peerName, remote);
    }

    return store.get(peerName);
  };
}

// ============================================================================
// Action Handler
// ============================================================================

/**
 * Create a handler for actions.
 * Actions are write-only: calling write() executes the action.
 *
 * @param {Object} actions - Map of action name to handler function
 * @returns {function} Handler function for mounting at /action
 *
 * @example
 * bl.mount('/action', createActionHandler({
 *   log: (params, bl) => console.log(params.message),
 *   notify: (params, bl) => sendNotification(params)
 * }));
 * bl.write('bl:///action/log?message=Hello');
 */
export function createActionHandler(actions = {}) {
  return function actionHandler(subpath, ref, bassline) {
    const handler = actions[subpath];
    if (!handler) {
      const available = Object.keys(actions).join(', ');
      throw new Error(`Unknown action: ${subpath}. Available: ${available || 'none'}`);
    }

    // Return a write-only mirror
    return {
      readable: false,
      writable: true,

      read() {
        throw new Error('Actions are not readable');
      },

      write(value) {
        const params = Object.fromEntries(ref.searchParams);
        return handler({ ...params, ...value }, bassline);
      },

      subscribe(cb) {
        return () => {}; // Actions don't emit events
      },

      setBassline() {} // No-op
    };
  };
}

// ============================================================================
// Built-in Actions
// ============================================================================

/**
 * Built-in actions for common use cases.
 */
export const builtinActions = {
  log: (params, bassline) => {
    const level = params.level || 'info';
    const message = params.message || '';
    switch (level) {
      case 'error': console.error(`[ACTION] ${message}`); break;
      case 'warn': console.warn(`[ACTION] ${message}`); break;
      case 'debug': console.debug(`[ACTION] ${message}`); break;
      default: console.log(`[ACTION] ${message}`);
    }
  },

  noop: () => {}
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a query string value to its proper type
 */
function parseValue(str) {
  const num = Number(str);
  if (!isNaN(num)) return num;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return str;
}
