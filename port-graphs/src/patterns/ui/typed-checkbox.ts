/**
 * Typed Checkbox Gadget
 *
 * A checkbox gadget with toggle, check, and uncheck operations.
 */

import { defGadget } from '../../core/typed';
import { withTaps } from '../../semantics/typed-extensions';
import type { CommandSpec } from '../specs';

/**
 * Checkbox state
 */
export type CheckboxState = {
  checked: boolean;
  disabled?: boolean;
  label?: string;
};

/**
 * Checkbox commands
 */
export type CheckboxCommands =
  | { toggle: {} }
  | { check: {} }
  | { uncheck: {} }
  | { setLabel: string }
  | { enable: {} }
  | { disable: {} };

/**
 * Checkbox specification
 */
export type CheckboxSpec = CommandSpec<
  CheckboxState,
  CheckboxCommands,
  {
    toggle: {};
    check: {};
    uncheck: {};
    setLabel: string;
    enable: {};
    disable: {};
    ignore: {};
  },
  {
    changed: boolean;
    checked: {};
    unchecked: {};
    configured: CheckboxState;
    noop: {};
  }
>;

/**
 * Creates a typed Checkbox gadget
 */
export function checkboxGadget(
  checked = false,
  label?: string,
  disabled = false
) {
  const baseGadget = defGadget<CheckboxSpec>(
    (state, command) => {
      // Handle toggle command
      if ('toggle' in command) {
        if (state.disabled) return { ignore: {} };
        return { toggle: {} };
      }

      // Handle check command
      if ('check' in command) {
        if (state.disabled) return { ignore: {} };
        if (!state.checked) {
          return { check: {} };
        }
        return { ignore: {} };
      }

      // Handle uncheck command
      if ('uncheck' in command) {
        if (state.disabled) return { ignore: {} };
        if (state.checked) {
          return { uncheck: {} };
        }
        return { ignore: {} };
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
      toggle: (gadget) => {
        const state = gadget.current();
        const newChecked = !state.checked;
        gadget.update({ ...state, checked: newChecked });

        if (newChecked) {
          return { checked: {} };
        } else {
          return { unchecked: {} };
        }
      },

      check: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, checked: true });
        return { checked: {} };
      },

      uncheck: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, checked: false });
        return { unchecked: {} };
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
  )({
    checked,
    ...(label !== undefined && { label }),
    disabled
  });

  return withTaps(baseGadget);
}