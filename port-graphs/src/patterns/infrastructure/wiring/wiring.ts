/**
 * Wiring Infrastructure Gadget
 *
 * Implements the Wiring Language (see README.md)
 *
 * Purpose: Connect gadgets by creating taps
 * Semantics: One-way forwarding of effects
 */

import { protoGadget, quick, withTaps, Implements } from '../../../core/context';
import { Protocols } from '../../../';
import { registryProto } from '../../cells';

// ================================================
// Types
// ================================================

export type WiringInput = {
  wire: {
    from: any;  // Should be tappable
    to: any;    // Should have receive
    via?: string;
  };
};

export type WiringActions =
  | { wire: { from: any; to: any; via: string; id: string } }
  | { error: { type: string; details: string } }
  | { ignore: {} };

export type WiringEffects = {
  wired?: { id: string };
  error?: { type: string; details: string };
};

export type WiringState = {
  cleanups: Implements<Protocols.Registry<() => void>>;
};

// ================================================
// Step - Validation Logic
// ================================================

export const wiringStep = (
  state: WiringState,
  input: WiringInput
): WiringActions => {
  if (!('wire' in input)) return { ignore: {} };

  const { from, to, via = 'changed' } = input.wire;

  // Validate from has tap
  if (typeof from?.tap !== 'function') {
    return { error: { type: 'invalid_source', details: 'Source must be tappable' } };
  }

  // Validate to has receive
  if (typeof to?.receive !== 'function') {
    return { error: { type: 'invalid_target', details: 'Target must have receive' } };
  }

  // Generate unique ID
  const id = `wire_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return { wire: { from, to, via, id } };
};

// ================================================
// Handlers - Execution Logic
// ================================================

export function wireHandler(
  g: { current: () => WiringState },
  actions: WiringActions
): WiringEffects {
  if ('wire' in actions) {
    const { from, to, via, id } = actions.wire;

    // Create the tap
    const cleanup = from.tap((effects: any) => {
      if (via in effects && effects[via] !== undefined) {
        to.receive(effects[via]);
      }
    });

    // Store cleanup function
    g.current().cleanups.receive({ register: { id, value: cleanup } });

    return { wired: { id } };
  }

  return {};
}

export function wiringErrorHandler(
  _g: { current: () => WiringState },
  actions: WiringActions
): WiringEffects {
  if ('error' in actions) {
    return { error: actions.error };
  }
  return {};
}

// ================================================
// Proto-Gadget
// ================================================

export const wiringProto = () =>
  protoGadget(wiringStep).handler((g, actions) => ({
    ...wireHandler(g, actions),
    ...wiringErrorHandler(g, actions)
  }));

// ================================================
// Factory
// ================================================

/**
 * Create a wiring gadget
 *
 * @returns A gadget implementing the Wiring Language
 */
export function createWiringGadget() {
  const initialState: WiringState = {
    cleanups: withTaps(quick(registryProto<() => void>(), new Map()))
  };

  return withTaps(quick(wiringProto(), initialState));
}