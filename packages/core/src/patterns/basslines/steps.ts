/**
 * Network Bassline Steps - Domain Logic with Validation
 */

import { Implements } from '../../core/context';
import { Protocols } from '../../';

// ================================================
// Types
// ================================================

export type GadgetFactory = () => any;

export type NetworkState = {
  factories: Implements<Protocols.Registry<GadgetFactory>>;
  instances: Implements<Protocols.Registry<any>>;
  connections: Implements<Protocols.Registry<() => void>>;
  enabled: boolean;
};

export type NetworkInput =
  | { define: { name: string; factory: GadgetFactory } }
  | { spawn: { id: string; type: string } }
  | { wire: { from: string; to: string; via?: string } }
  | { destroy: string }
  | { enable: {} }
  | { disable: {} };

export type NetworkActions =
  | { define: { name: string; factory: GadgetFactory } }
  | { spawn: { id: string; type: string; factory: GadgetFactory } }
  | { wire: { from: string; to: string; via: string; fromGadget: any; toGadget: any } }
  | { destroy: { id: string; instance: any; connectionIds: string[] } }
  | { enable: {} }
  | { disable: {} }
  | { error: { type: string; details: string } }
  | { ignore: {} };

// ================================================
// Step - Pure Logic with Validation
// ================================================

export const networkStep = (
  state: NetworkState,
  input: NetworkInput
): NetworkActions => {
  // Disabled networks ignore everything except enable
  if (!state.enabled && !('enable' in input)) {
    return { ignore: {} };
  }

  if ('define' in input) {
    return { define: input.define };
  }

  if ('spawn' in input) {
    const { id, type } = input.spawn;
    const factory = state.factories.current().get(type);

    if (!factory) {
      return { error: { type: 'unknown_type', details: `No factory for type: ${type}` } };
    }

    return { spawn: { id, type, factory } };
  }

  if ('wire' in input) {
    const { from, to, via = 'changed' } = input.wire;
    const fromGadget = state.instances.current().get(from);
    const toGadget = state.instances.current().get(to);

    if (!fromGadget) {
      return { error: { type: 'not_found', details: `Source not found: ${from}` } };
    }

    if (!toGadget) {
      return { error: { type: 'not_found', details: `Target not found: ${to}` } };
    }

    if (typeof fromGadget.tap !== 'function') {
      return { error: { type: 'invalid_wire', details: `${from} not tappable` } };
    }

    if (typeof toGadget.receive !== 'function') {
      return { error: { type: 'invalid_wire', details: `${to} cannot receive` } };
    }

    return { wire: { from, to, via, fromGadget, toGadget } };
  }

  if ('destroy' in input) {
    const id = input.destroy;
    const instance = state.instances.current().get(id);

    if (!instance) {
      return { error: { type: 'not_found', details: `Instance not found: ${id}` } };
    }

    // Find all connections involving this gadget
    const connectionIds: string[] = [];
    for (const wireId of state.connections.current().keys()) {
      if (wireId.includes(id)) {
        connectionIds.push(wireId);
      }
    }

    return { destroy: { id, instance, connectionIds } };
  }

  if ('enable' in input) {
    return { enable: {} };
  }

  if ('disable' in input) {
    return { disable: {} };
  }

  return { ignore: {} };
};
