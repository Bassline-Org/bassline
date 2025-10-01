/**
 * Spawning Infrastructure Gadget
 *
 * Implements the Spawning Language (see README.md)
 *
 * Purpose: Create gadget instances from factories
 * Semantics: Call factory, store instance, emit event
 */

import { protoGadget, quick, withTaps, Implements } from '../../../core/context';
import { Protocols } from '../../../';
import { registryProto } from '../../cells';

// ================================================
// Types
// ================================================

export type SpawningInput = {
  spawn: {
    id: string;
    factory: () => any;
  };
};

export type SpawningActions =
  | { spawn: { id: string; factory: () => any } }
  | { error: { type: string; details: string } }
  | { ignore: {} };

export type SpawningEffects = {
  spawned?: { id: string };
  error?: { type: string; details: string };
};

export type SpawningState = {
  instances: Implements<Protocols.Registry<any>>;
};

// ================================================
// Step - Validation Logic
// ================================================

export const spawningStep = (
  _state: SpawningState,
  input: SpawningInput
): SpawningActions => {
  if (!('spawn' in input)) return { ignore: {} };

  const { id, factory } = input.spawn;

  // Validate factory is a function
  if (typeof factory !== 'function') {
    return { error: { type: 'invalid_factory', details: 'Factory must be a function' } };
  }

  return { spawn: { id, factory } };
};

// ================================================
// Handlers - Execution Logic
// ================================================

export function spawnHandler(
  g: { current: () => SpawningState },
  actions: SpawningActions
): Partial<SpawningEffects> {
  if ('spawn' in actions) {
    const { id, factory } = actions.spawn;

    try {
      // Call factory to create instance
      const instance = factory();

      // Store in registry
      g.current().instances.receive({ register: { id, value: instance } });

      return { spawned: { id } };
    } catch (e) {
      return {
        error: {
          type: 'spawn_failed',
          details: e instanceof Error ? e.message : String(e)
        }
      };
    }
  }

  return {};
}

export function errorHandler(
  _g: { current: () => SpawningState },
  actions: SpawningActions
): Partial<SpawningEffects> {
  if ('error' in actions) {
    return { error: actions.error };
  }
  return {};
}

// ================================================
// Proto-Gadget
// ================================================

export const spawningProto = () =>
  protoGadget(spawningStep).handler((g, actions) => ({
    ...spawnHandler(g, actions),
    ...errorHandler(g, actions)
  }));

// ================================================
// Factory
// ================================================

/**
 * Create a spawning gadget
 *
 * @returns A gadget implementing the Spawning Language
 */
export function createSpawningGadget() {
  const initialState: SpawningState = {
    instances: withTaps(quick(registryProto<any>(), new Map()))
  };

  return withTaps(quick(spawningProto(), initialState));
}