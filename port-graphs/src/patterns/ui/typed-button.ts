/**
 * Typed Button Gadget
 *
 * A simple button gadget that emits click events.
 */

import { Actions, defGadget, Effects, Input, State } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';

/**
 * Button state
 */
export type ButtonState = {
  disabled?: boolean;
  label: string;
};

/**
 * Button commands
 */
export type ButtonCommands =
  | { click: {} }
  | { setLabel: string }
  | { enable: {} }
  | { disable: {} };

/**
 * Button specification
 */
export type ButtonSpec =
  & State<ButtonState>
  & Input<ButtonCommands>
  & Actions<
    {
      click: {};
      setLabel: string;
      enable: {};
      disable: {};
      ignore: {};
    }>
  & Effects<{
    clicked: {};
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
  const baseGadget = defGadget<ButtonSpec>({
    dispatch: (state, command) => {
      // Handle click command
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
    methods: {
      click: () => {
        // Click is a simple event emission
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
        const newState = { ...state, disabled: true };
        gadget.update(newState);
        return { configured: newState };
      },

      ignore: () => ({ noop: {} })
    }
  })({
    disabled,
    label
  });

  return withTaps(baseGadget);
}