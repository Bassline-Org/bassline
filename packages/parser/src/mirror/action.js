/**
 * ActionMirror - Fire-and-forget actions triggered by standalone refs
 *
 * Actions are invoked by inserting a ref into the graph (not as part of a quad).
 * Parameters come from the URI query string.
 *
 * Example:
 *   graph.add(ref('bl:///action/log?message=hello&level=info'))
 *
 * Actions are fire-and-forget - they don't return values.
 * If an action needs to communicate results, it can insert quads into the graph.
 */

import { BaseMirror } from './interface.js';
import { registerMirrorType } from './serialize.js';

/**
 * ActionMirror - executes a handler when triggered
 */
export class ActionMirror extends BaseMirror {
  /**
   * @param {function} handler - (params: object, graph: Graph, ref: Ref) => void
   * @param {object} options - Optional configuration
   * @param {string} options.name - Action name (for debugging)
   * @param {string} options.doc - Documentation string
   */
  constructor(handler, options = {}) {
    super();
    this._handler = handler;
    this._name = options.name || 'action';
    this._doc = options.doc || '';
  }

  get readable() {
    return false;
  }

  get writable() {
    return true; // Actions accept "writes" via trigger
  }

  /**
   * Writing to an action triggers it with the value as params
   * This allows programmatic triggering without a ref
   */
  write(params) {
    this._handler(params, null, null);
  }

  /**
   * Called when this ref is inserted standalone (not as part of a quad)
   *
   * This is the primary way to trigger actions - just insert the ref!
   * Parameters are extracted from the URI query string.
   *
   * @param {Graph} graph - The graph
   * @param {Ref} ref - The ref being triggered (contains params in searchParams)
   */
  onTrigger(graph, ref) {
    const params = Object.fromEntries(ref.searchParams);
    this._handler(params, graph, ref);
  }

  /**
   * Called when this ref appears in a quad being inserted (middleware)
   *
   * By default, actions don't store themselves in quads - they just execute.
   * Override this in subclasses for different behavior.
   *
   * @param {Quad} quad - The quad being inserted
   * @param {Graph} graph - The graph receiving the insert
   * @returns {boolean} - Return false to block insert
   */
  onInsert(quad, graph) {
    // Execute the action with quad context
    this._handler({ quad }, graph, null);
    return false; // Don't store the action quad by default
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  static get mirrorType() {
    return 'action';
  }

  /**
   * Serialize action config (handler function cannot be serialized)
   */
  toJSON() {
    return {
      $mirror: 'action',
      name: this._name,
      doc: this._doc
    };
  }

  /**
   * Deserialize action - looks up registered action by name
   *
   * If no action is registered, creates a placeholder that throws on trigger.
   */
  static fromJSON(data, registry = null) {
    if (registry) {
      const actionStore = registry.getStore('actions');
      if (actionStore.has(data.name)) {
        return actionStore.get(data.name);
      }
    }

    // No registered action - return placeholder
    return new ActionMirror(
      () => { throw new Error(`Action '${data.name}' not registered`); },
      { name: data.name, doc: data.doc }
    );
  }
}

/**
 * Create an ActionMirror
 * @param {function} handler - (params, graph, ref) => void
 * @param {object} options - Optional configuration
 */
export function action(handler, options = {}) {
  return new ActionMirror(handler, options);
}

/**
 * Action type handler for bl:///action/[name]
 *
 * Actions are registered in the 'actions' store.
 * The handler receives params from the URI query string.
 */
export function actionTypeHandler(subpath, ref, registry) {
  const actionStore = registry.getStore('actions');

  // Get or create the action mirror
  if (!actionStore.has(subpath)) {
    // No action registered for this name
    throw new Error(
      `Unknown action: ${subpath}. ` +
      `Register with registry.getStore('actions').set('${subpath}', handler)`
    );
  }

  const handler = actionStore.get(subpath);

  // If it's already an ActionMirror, return it
  if (handler instanceof ActionMirror) {
    return handler;
  }

  // Wrap function in ActionMirror
  const mirror = new ActionMirror(handler, { name: subpath });
  actionStore.set(subpath, mirror);
  return mirror;
}

/**
 * Register an action handler
 *
 * @param {RefRegistry} registry - The registry
 * @param {string} name - Action name (path under bl:///action/)
 * @param {function} handler - (params, graph, ref) => void
 * @param {object} options - Optional configuration
 */
export function registerAction(registry, name, handler, options = {}) {
  const actionStore = registry.getStore('actions');
  actionStore.set(name, new ActionMirror(handler, { name, ...options }));
}

// ============================================================================
// Built-in Actions
// ============================================================================

/**
 * Built-in log action
 * Usage: bl:///action/log?message=hello&level=info
 */
export const logAction = (params, graph, ref) => {
  const level = params.level || 'info';
  const message = params.message || '';

  switch (level) {
    case 'error':
      console.error(`[ACTION] ${message}`);
      break;
    case 'warn':
      console.warn(`[ACTION] ${message}`);
      break;
    case 'debug':
      console.debug(`[ACTION] ${message}`);
      break;
    default:
      console.log(`[ACTION] ${message}`);
  }
};

/**
 * Built-in noop action (for testing)
 * Usage: bl:///action/noop
 */
export const noopAction = () => {
  // Do nothing
};

/**
 * Install built-in actions
 */
export function installBuiltinActions(registry) {
  registerAction(registry, 'log', logAction, { doc: 'Log message to console' });
  registerAction(registry, 'noop', noopAction, { doc: 'Do nothing (for testing)' });
}

// Register with serialization system
registerMirrorType('action', ActionMirror.fromJSON);
