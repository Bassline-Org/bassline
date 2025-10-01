/**
 * Network Bassline Factory
 *
 * Creates a gadget that manages other gadgets:
 * - Registers factory functions
 * - Spawns instances from factories
 * - Wires gadgets together
 * - Cleans up on destroy
 *
 * Uses Registry gadgets internally for storage (gadgets all the way down!)
 */

import { quick, withTaps, Implements } from '../../core/context';
import { Protocols } from '../../';
import { registryProto } from '../cells';
import { networkProto } from './protos';
import type { NetworkState, GadgetFactory } from './steps';

/**
 * Create a new network bassline with internal registries.
 */
export function createNetworkBassline() {
  const initialState: NetworkState = {
    factories: withTaps(quick(registryProto<GadgetFactory>(), new Map())),
    instances: withTaps(quick(registryProto<any>(), new Map())),
    connections: withTaps(quick(registryProto<() => void>(), new Map())),
    enabled: true,
  };

  return withTaps(quick(networkProto(), initialState));
}

// Re-export types for convenience
export type { NetworkState, NetworkInput, NetworkActions, GadgetFactory } from './steps';
