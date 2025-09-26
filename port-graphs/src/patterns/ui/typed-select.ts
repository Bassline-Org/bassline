/**
 * Typed Select/Dropdown Gadget
 *
 * A generic select gadget that can work with any type of options.
 */

import { Actions, defGadget, Effects, Input, State } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';

/**
 * Select state - generic over option type
 */
export type SelectState<T> = {
  value: T | undefined;
  options: T[];
  disabled?: boolean;
};

/**
 * Select commands
 */
export type SelectCommands<T> =
  | { select: T }
  | { setOptions: T[] }
  | { clear: {} }
  | { enable: {} }
  | { disable: {} };

/**
 * Select specification
 */
export type SelectSpec<T> =
  & State<SelectState<T>>
  & Input<SelectCommands<T>>
  & Actions<
    {
      select: T;
      setOptions: T[];
      clear: {};
      enable: {};
      disable: {};
      ignore: {};
    }>
  & Effects<{
    changed: T;
    optionsChanged: T[];
    cleared: {};
    configured: SelectState<T>;
    noop: {};
  }
  >;

/**
 * Creates a typed Select gadget
 */
export function selectGadget<T>(
  options: T[] = [],
  initial?: T,
  disabled = false
) {
  const baseGadget = defGadget<SelectSpec<T>>({
    dispatch: (state, command) => {
      // Handle select command
      if ('select' in command) {
        if (state.disabled) return { ignore: {} };

        // Verify the option exists
        const exists = state.options.some(opt => opt === command.select);
        if (!exists) return { ignore: {} };

        if (command.select !== state.value) {
          return { select: command.select };
        }
        return { ignore: {} };
      }

      // Handle setOptions command
      if ('setOptions' in command) {
        return { setOptions: command.setOptions };
      }

      // Handle clear command
      if ('clear' in command) {
        if (state.disabled) return { ignore: {} };
        if (state.value !== undefined) {
          return { clear: {} };
        }
        return { ignore: {} };
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
    methods: {
      select: (gadget, value) => {
        const state = gadget.current();
        gadget.update({ ...state, value });
        return { changed: value };
      },

      setOptions: (gadget, options) => {
        const state = gadget.current();

        // Clear value if it's not in new options
        let newValue = state.value;
        if (newValue !== undefined && !options.some(opt => opt === newValue)) {
          newValue = undefined;
        }

        const newState = { ...state, options, value: newValue };
        gadget.update(newState);
        return { optionsChanged: options };
      },

      clear: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, value: undefined });
        return { cleared: {} };
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
  })({
    value: initial,
    options,
    disabled
  });

  return withTaps(baseGadget);
}