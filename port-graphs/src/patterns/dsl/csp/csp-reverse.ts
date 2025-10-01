/**
 * Reverse Compilation: Network Effects → CSP Commands
 *
 * Enables bidirectional liveness by reconstructing CSP commands from network effects.
 * This allows the network to "talk back" to the CSP layer.
 */

import type { CSPInput } from './csp';
import type { NetworkEffects, NetworkState } from '../network/network';
import type { Implements } from '../../../core/context';
import type { Valued } from '../../../core/protocols';

/**
 * Convert network effects back into CSP commands
 *
 * This is the reverse of the forward compilation that happens in CSP handlers.
 *
 * Forward:  CSP commands → Network effects
 * Reverse:  Network effects → CSP commands
 *
 * @param effects - Effects emitted by the network
 * @param networkState - Current network state (for lookups)
 * @returns Array of CSP commands that would produce equivalent effects
 */
export function networkEffectsToCSPCommands(
  effects: Partial<NetworkEffects>,
  networkState: NetworkState
): CSPInput[] {
  const commands: CSPInput[] = [];

  // Reverse compile: defined → variable
  if (effects.defined) {
    const name = effects.defined;
    const factory = networkState.definitions.current().get(name);

    if (factory && !name.startsWith('propagator_')) {
      // This is a variable type definition
      commands.push({
        variable: {
          name,
          domain: factory as () => Implements<Valued<unknown>>
        }
      });
    }
  }

  // Reverse compile: spawned → create
  if (effects.spawned) {
    const { id } = effects.spawned;
    const type = networkState.instanceTypes.current().get(id);

    if (type && !id.startsWith('prop_')) {
      // This is a variable instance (not a propagator)
      const instances = networkState.spawning.current().instances.current();
      const instance = instances.get(id);

      if (instance && typeof instance.current === 'function') {
        // Get current domain
        const domain = instance.current();

        commands.push({
          create: {
            id,
            type,
            domain
          }
        });
      }
    }
  }

  // Reverse compile: wired → relate (for propagators)
  // Note: This is more complex because wiring doesn't directly tell us about constraints.
  // We'd need to track which wires are part of constraint propagation.
  // For now, we skip this - constraints are typically set up once at CSP creation.
  // If we need to reverse-compile constraints, we'd need to add metadata to propagators.

  return commands;
}

/**
 * Extract full CSP state from network by introspecting
 *
 * This is more complete than reverse-compiling effects - it reconstructs
 * the entire CSP description from a running network.
 *
 * Useful for:
 * - Initial sync when attaching live system to existing network
 * - Debugging/inspection
 * - Serialization
 */
export function extractCSPState(networkState: NetworkState): {
  types: Array<{ name: string; factory: () => Implements<Valued<unknown>> }>;
  variables: Array<{ id: string; type: string; domain: unknown }>;
} {
  const types: Array<{ name: string; factory: () => Implements<Valued<unknown>> }> = [];
  const variables: Array<{ id: string; type: string; domain: unknown }> = [];

  // Extract type definitions (non-propagator factories)
  const definitions = networkState.definitions.current();
  definitions.forEach((factory, name) => {
    if (!name.startsWith('propagator_')) {
      types.push({
        name,
        factory: factory as () => Implements<Valued<unknown>>
      });
    }
  });

  // Extract variable instances
  const instances = networkState.spawning.current().instances.current();
  const instanceTypes = networkState.instanceTypes.current();

  instances.forEach((gadget, id) => {
    if (!id.startsWith('prop_') && typeof gadget.current === 'function') {
      const type = instanceTypes.get(id);
      if (type) {
        variables.push({
          id,
          type,
          domain: gadget.current()
        });
      }
    }
  });

  return { types, variables };
}