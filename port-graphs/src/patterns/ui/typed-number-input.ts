/**
 * Typed NumberInput Gadget
 *
 * A number input gadget with validation, min/max constraints,
 * and step increments.
 */

import { defGadget } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';
import type { CommandSpec } from '../specs';

/**
 * NumberInput state
 */
export type NumberInputState = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

/**
 * NumberInput commands
 */
export type NumberInputCommands =
  | { set: number }
  | { increment: {} }
  | { decrement: {} }
  | { configure: { min?: number; max?: number; step?: number } }
  | { enable: {} }
  | { disable: {} };

/**
 * NumberInput specification
 */
export type NumberInputSpec = CommandSpec<
  NumberInputState,
  NumberInputCommands,
  {
    set: number;
    configure: { min?: number; max?: number; step?: number };
    enable: {};
    disable: {};
    ignore: {};
  },
  {
    changed: number;
    validated: number;
    configured: NumberInputState;
    noop: {};
  }
>;

/**
 * Validates a number against min/max constraints
 */
function clampValue(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

/**
 * Creates a typed NumberInput gadget
 */
export function numberInputGadget(
  initial = 0,
  min?: number,
  max?: number,
  step = 1,
  disabled = false
) {
  const baseGadget = defGadget<NumberInputSpec>(
    (state, command) => {
      // Handle set command
      if ('set' in command) {
        if (state.disabled) return { ignore: {} };
        if (command.set !== state.value) {
          return { set: command.set };
        }
        return { ignore: {} };
      }

      // Handle increment command
      if ('increment' in command) {
        if (state.disabled) return { ignore: {} };

        const newValue = state.value + (state.step || 1);
        return { set: newValue };
      }

      // Handle decrement command
      if ('decrement' in command) {
        if (state.disabled) return { ignore: {} };

        const newValue = state.value - (state.step || 1);
        return { set: newValue };
      }

      // Handle configure command
      if ('configure' in command) {
        return { configure: command.configure };
      }

      // Handle enable/disable commands
      if ('enable' in command) {
        if (state.disabled) {
          return { enable: {} };
        }
        return { ignore: {} };
      }

      if ('disable' in command) {
        if (!state.disabled) {
          return { disable: {} };
        }
        return { ignore: {} };
      }

      return { ignore: {} };
    },
    {
      set: (gadget, value) => {
        const state = gadget.current();

        // Check if value was clamped
        const original = value;
        const clamped = clampValue(value, state.min, state.max);
        if (clamped !== state.value) {
          gadget.update({ ...state, value: clamped });
          if (original !== clamped) {
            return { validated: clamped };
          }
          return { changed: clamped };
        } else {
          return { noop: {} };
        }
      },
      configure: (gadget, config) => {
        const state = gadget.current();
        const newState = {
          ...state,
          ...config
        };

        // Re-validate current value with new constraints
        const clamped = clampValue(state.value, newState.min, newState.max);
        if (clamped !== state.value) {
          newState.value = clamped;
        }
        if (newState.value !== state.value) {
          gadget.update(newState);
          return { changed: newState.value, configured: newState };
        } else {
          return { noop: {} };
        }
      },
      enable: (gadget) => {
        const state = gadget.current();
        const newState = { ...state, disabled: false };
        gadget.update(newState);
        return { configured: newState };
      },

      disable: (gadget) => {
        const state = gadget.current();
        const newState = { ...state, disabled: true };
        gadget.update(newState);
        return { configured: newState };
      },

      ignore: () => ({ noop: {} })
    }
  )({
    value: clampValue(initial, min, max),
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
    step,
    disabled
  });

  return withTaps(baseGadget);
}