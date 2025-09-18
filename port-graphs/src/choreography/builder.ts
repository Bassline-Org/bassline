/**
 * Network builder from choreography specifications
 *
 * Instantiates gadgets and sends bootstrap messages
 */

import { Choreography, GadgetRegistry } from './types';
import { defaultRegistry } from './registry';
import type { Gadget } from '../core';

export interface NetworkResult {
  /**
   * Map of gadget ID to gadget instance
   */
  gadgets: Map<string, Gadget>;

  /**
   * Get a gadget by ID (type-safe helper)
   */
  get<T extends Gadget = Gadget>(id: string): T | undefined;

  /**
   * Send data to a specific gadget
   */
  send(to: string, data: any): void;

  /**
   * List all gadget IDs
   */
  ids(): string[];
}

/**
 * Build a network from a choreography specification
 */
export function buildNetwork(
  choreography: Choreography,
  registry: GadgetRegistry = defaultRegistry
): NetworkResult {
  const gadgets = new Map<string, Gadget>();

  // Phase 1: Create all gadgets
  for (const [id, spec] of Object.entries(choreography.gadgets)) {
    const factory = registry[spec.type];

    if (!factory) {
      throw new Error(`Unknown gadget type: ${spec.type}`);
    }

    try {
      const gadget = factory(spec.initial);
      gadgets.set(id, gadget);
    } catch (error) {
      throw new Error(`Failed to create gadget '${id}' of type '${spec.type}': ${error}`);
    }
  }

  // Phase 2: Register gadgets with any pubsub brokers
  for (const [id, gadget] of gadgets) {
    // If this is a pubsub broker, register all other gadgets with it
    const spec = choreography.gadgets[id];
    if (spec?.type === 'pubsub') {
      for (const [otherId, otherGadget] of gadgets) {
        if (otherId !== id) {
          gadget.receive({ registerGadget: { id: otherId, gadget: otherGadget } });
        }
      }
    }
  }

  // Phase 3: Send bootstrap messages
  if (choreography.bootstrap) {
    for (const message of choreography.bootstrap) {
      const gadget = gadgets.get(message.to);

      if (!gadget) {
        console.warn(`Bootstrap target '${message.to}' not found`);
        continue;
      }

      try {
        gadget.receive(message.data);
      } catch (error) {
        console.error(`Failed to send bootstrap message to '${message.to}':`, error);
      }
    }
  }

  // Return network interface
  return {
    gadgets,

    get<T extends Gadget = Gadget>(id: string): T | undefined {
      return gadgets.get(id) as T;
    },

    send(to: string, data: any): void {
      const gadget = gadgets.get(to);
      if (gadget) {
        gadget.receive(data);
      } else {
        throw new Error(`Gadget '${to}' not found`);
      }
    },

    ids(): string[] {
      return Array.from(gadgets.keys());
    }
  };
}

/**
 * Build a network with a custom registry
 */
export function buildNetworkWithRegistry(
  choreography: Choreography,
  customTypes: GadgetRegistry
): NetworkResult {
  const registry = {
    ...defaultRegistry,
    ...customTypes
  };

  return buildNetwork(choreography, registry);
}