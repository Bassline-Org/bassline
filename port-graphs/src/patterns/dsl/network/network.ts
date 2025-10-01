/**
 * Network DSL Gadget
 *
 * Implements the Network Language (see README.md)
 *
 * Purpose: High-level network construction
 * Compilation: Forwards to infrastructure gadgets (spawning, wiring)
 */

import { protoGadget, quick, withTaps, Implements } from '../../../core/context';
import { Protocols } from '../../../';
import { registryProto } from '../../cells';
import { createSpawningGadget } from '../../infrastructure/spawning/spawning';
import { createWiringGadget } from '../../infrastructure/wiring/wiring';

// ================================================
// Types
// ================================================

export type GadgetFactory = () => any;

export type NetworkInput =
  | { define: { name: string; factory: GadgetFactory } }
  | { spawn: { id: string; type: string } }
  | { wire: { from: string; to: string; via?: string } };

export type NetworkActions =
  | { define: { name: string; factory: GadgetFactory } }
  | { spawn: { id: string; type: string; factory: GadgetFactory } }
  | { wire: { from: string; to: string; via: string; fromGadget: any; toGadget: any } }
  | { error: { type: string; details: string } }
  | { ignore: {} };

export type NetworkEffects = {
  defined?: string;
  spawned?: { id: string };
  wired?: { from: string; to: string };
  error?: { type: string; details: string };
};

export type NetworkState = {
  definitions: Implements<Protocols.Registry<GadgetFactory>>;
  spawning: ReturnType<typeof createSpawningGadget>;
  wiring: ReturnType<typeof createWiringGadget>;
};

// ================================================
// Steps - Validation & Preparation
// ================================================

export const networkStep = (
  state: NetworkState,
  input: NetworkInput
): NetworkActions => {
  // Define term - just pass through
  if ('define' in input) {
    return { define: input.define };
  }

  // Spawn term - validate type exists, lookup factory
  if ('spawn' in input) {
    const { id, type } = input.spawn;
    const factory = state.definitions.current().get(type);

    if (!factory) {
      return { error: { type: 'unknown_type', details: `No factory for type: ${type}` } };
    }

    return { spawn: { id, type, factory } };
  }

  // Wire term - validate instances exist, lookup gadgets
  if ('wire' in input) {
    const { from, to, via = 'changed' } = input.wire;
    const fromGadget = state.spawning.current().instances.current().get(from);
    const toGadget = state.spawning.current().instances.current().get(to);

    if (!fromGadget) {
      return { error: { type: 'not_found', details: `Source not found: ${from}` } };
    }

    if (!toGadget) {
      return { error: { type: 'not_found', details: `Target not found: ${to}` } };
    }

    return { wire: { from, to, via, fromGadget, toGadget } };
  }

  return { ignore: {} };
};

// ================================================
// Handlers - Forward to Infrastructure
// ================================================

export function defineHandler(
  g: { current: () => NetworkState },
  actions: NetworkActions
): Partial<NetworkEffects> {
  if ('define' in actions) {
    const { name, factory } = actions.define;

    // FORWARD to definitions registry
    g.current().definitions.receive({ register: { id: name, value: factory } });

    return { defined: name };
  }
  return {};
}

export function spawnHandler(
  g: { current: () => NetworkState },
  actions: NetworkActions
): Partial<NetworkEffects> {
  if ('spawn' in actions) {
    const { id, factory } = actions.spawn;

    // FORWARD to spawning gadget
    g.current().spawning.receive({ spawn: { id, factory } });

    return { spawned: { id } };
  }
  return {};
}

export function wireHandler(
  g: { current: () => NetworkState },
  actions: NetworkActions
): Partial<NetworkEffects> {
  if ('wire' in actions) {
    const { from, to, via, fromGadget, toGadget } = actions.wire;

    // FORWARD to wiring gadget
    g.current().wiring.receive({
      wire: { from: fromGadget, to: toGadget, via }
    });

    return { wired: { from, to } };
  }
  return {};
}

export function errorHandler(
  _g: { current: () => NetworkState },
  actions: NetworkActions
): Partial<NetworkEffects> {
  if ('error' in actions) {
    return { error: actions.error };
  }
  return {};
}

// ================================================
// Proto-Gadget - Compose Handlers
// ================================================

export const networkProto = () =>
  protoGadget(networkStep).handler((g, actions) => ({
    ...defineHandler(g, actions),
    ...spawnHandler(g, actions),
    ...wireHandler(g, actions),
    ...errorHandler(g, actions)
  }));

// ================================================
// Factory
// ================================================

/**
 * Create a network DSL gadget
 *
 * @returns A gadget implementing the Network Language
 */
export function createNetworkGadget() {
  const initialState: NetworkState = {
    definitions: withTaps(quick(registryProto<GadgetFactory>(), new Map())),
    spawning: createSpawningGadget(),
    wiring: createWiringGadget()
  };

  return withTaps(quick(networkProto(), initialState));
}