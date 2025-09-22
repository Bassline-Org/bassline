/**
 * Typed TextInput Gadget
 *
 * A text input gadget that follows the command pattern for handling
 * text input state and operations.
 */

import { defGadget } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';
import type { CommandSpec } from '../specs';

/**
 * TextInput state
 */
export type TextInputState = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * TextInput commands
 */
export type TextInputCommands =
  | { set: string }
  | { clear: {} }
  | { setPlaceholder: string }
  | { enable: {} }
  | { disable: {} };

/**
 * TextInput specification
 */
export type TextInputSpec = CommandSpec<
  TextInputState,
  TextInputCommands,
  {
    set: string;
    clear: {};
    setPlaceholder: string;
    enable: {};
    disable: {};
    ignore: {};
  },
  {
    changed: string;
    cleared: {};
    configured: TextInputState;
    noop: {};
  }
>;

/**
 * Creates a typed TextInput gadget
 */
export function textInputGadget(
  initial = '',
  placeholder?: string,
  disabled = false
) {
  const baseGadget = defGadget<TextInputSpec>(
    (state, command) => {
      // Handle set command
      if ('set' in command) {
        if (state.disabled) return { ignore: {} };
        if (command.set !== state.value) {
          return { set: command.set };
        }
        return { ignore: {} };
      }

      // Handle clear command
      if ('clear' in command) {
        if (state.disabled) return { ignore: {} };
        if (state.value !== '') {
          return { clear: {} };
        }
        return { ignore: {} };
      }

      // Handle placeholder command
      if ('setPlaceholder' in command) {
        if (command.setPlaceholder !== state.placeholder) {
          return { setPlaceholder: command.setPlaceholder };
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
    {
      set: (gadget, value) => {
        const state = gadget.current();
        gadget.update({ ...state, value });
        return { changed: value };
      },

      clear: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, value: '' });
        return { cleared: {} };
      },

      setPlaceholder: (gadget, placeholder) => {
        const state = gadget.current();
        const newState = { ...state, placeholder };
        gadget.update(newState);
        return { configured: newState };
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
    value: initial,
    ...(placeholder !== undefined && { placeholder }),
    disabled
  });

  return withTaps(baseGadget);
}