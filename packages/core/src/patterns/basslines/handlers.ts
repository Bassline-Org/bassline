/**
 * Network Bassline Handlers - Individual, Reusable Handler Functions
 */

import { HandlerContext } from '../../core/context';
import type { NetworkState, NetworkActions } from './steps';

// ================================================
// Individual Handlers (Composable)
// ================================================

export function defineHandler(
  g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { defined?: string, ignore?: {} } {
  if ('define' in actions) {
    const { name, factory } = actions.define;
    g.current().factories.receive({ register: { id: name, value: factory } });
    return { defined: name };
  }
  return { ignore: {} };
}

export function spawnHandler(
  g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { spawned?: { id: string }, error?: { type: string; details: string }, ignore?: {} } {
  if ('spawn' in actions) {
    const { id, factory } = actions.spawn;
    try {
      const instance = factory();
      g.current().instances.receive({ register: { id, value: instance } });
      return { spawned: { id } };
    } catch (e) {
      return { error: { type: 'spawn_failed', details: String(e) } };
    }
  }
  return { ignore: {} };
}

export function wireHandler(
  g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { wired?: { from: string; to: string }, ignore?: {} } {
  if ('wire' in actions) {
    const { from, to, via, fromGadget, toGadget } = actions.wire;

    // Setup the tap connection
    const cleanup = fromGadget.tap((effects: any) => {
      if (via in effects && effects[via] !== undefined) {
        toGadget.receive(effects[via]);
      }
    });

    // Store cleanup function
    const wireId = `${from}→${to}:${via}`;
    g.current().connections.receive({ register: { id: wireId, value: cleanup } });

    return { wired: { from, to } };
  }
  return { ignore: {} };
}

export function destroyHandler(
  g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { destroyed?: string, ignore?: {} } {
  if ('destroy' in actions) {
    const { id, connectionIds } = actions.destroy;
    const state = g.current();

    // Cleanup all connections
    for (const wireId of connectionIds) {
      const cleanup = state.connections.current().get(wireId);
      if (cleanup) {
        cleanup();
        state.connections.receive({ unregister: wireId });
      }
    }

    // Remove instance
    state.instances.receive({ unregister: id });

    return { destroyed: id };
  }
  return { ignore: {} };
}

export function toggleHandler(
  g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { enabled?: {}, disabled?: {}, ignore?: {} } {
  const state = g.current();

  if ('enable' in actions) {
    g.update({ ...state, enabled: true });
    return { enabled: {} };
  }

  if ('disable' in actions) {
    g.update({ ...state, enabled: false });
    return { disabled: {} };
  }

  return { ignore: {} };
}

export function errorHandler(
  _g: HandlerContext<NetworkState>,
  actions: NetworkActions
): { error?: { type: string; details: string }, ignore?: {} } {
  if ('error' in actions) {
    return { error: actions.error };
  }
  return { ignore: {} };
}