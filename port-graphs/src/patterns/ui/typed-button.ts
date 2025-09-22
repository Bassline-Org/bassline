/**
 * Typed Button Gadget
 *
 * A button gadget that tracks press/release states and emits click events.
 */

import { defGadget } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';
import type { CommandSpec } from '../specs';

/**
 * Button state
 */
export type ButtonState = {
  pressed: boolean;
  disabled?: boolean;
  label: string;
};

/**
 * Button commands
 */
export type ButtonCommands =
  | { press: {} }
  | { release: {} }
  | { click: {} }
  | { setLabel: string }
  | { enable: {} }
  | { disable: {} };

/**
 * Button specification
 */
export type ButtonSpec = CommandSpec<
  ButtonState,
  ButtonCommands,
  {
    press: {};
    release: {};
    click: {};
    setLabel: string;
    enable: {};
    disable: {};
    ignore: {};
  },
  {
    clicked: {};
    pressed: {};
    released: {};
    configured: ButtonState;
    noop: {};
  }
>;

/**
 * Creates a typed Button gadget
 */
export function buttonGadget(
  label = 'Button',
  disabled = false
) {
  const baseGadget = defGadget<ButtonSpec>(
    (state, command) => {
      // Handle press command
      if ('press' in command) {
        if (state.disabled) return { ignore: {} };
        if (!state.pressed) {
          return { press: {} };
        }
        return { ignore: {} };
      }

      // Handle release command
      if ('release' in command) {
        if (state.disabled) return { ignore: {} };
        if (state.pressed) {
          return { release: {} };
        }
        return { ignore: {} };
      }

      // Handle click command (combined press + release)
      if ('click' in command) {
        if (state.disabled) return { ignore: {} };
        return { click: {} };
      }

      // Handle setLabel command
      if ('setLabel' in command) {
        if (command.setLabel !== state.label) {
          return { setLabel: command.setLabel };
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
      press: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, pressed: true });
        return { pressed: {} };
      },

      release: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, pressed: false });
        return { released: {} };
      },

      click: (gadget) => {
        // Click doesn't change pressed state (momentary action)
        return { clicked: {} };
      },

      setLabel: (gadget, label) => {
        const state = gadget.current();
        const newState = { ...state, label };
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
        const newState = { ...state, disabled: true, pressed: false };
        gadget.update(newState);
        return { configured: newState };
      },

      ignore: () => ({ noop: {} })
    }
  )({
    pressed: false,
    disabled,
    label
  });

  return withTaps(baseGadget);
}