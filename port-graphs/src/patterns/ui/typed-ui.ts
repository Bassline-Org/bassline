/**
 * Typed UI gadgets using generic extensions
 */

import { Actions, defGadget, Effects, Input, State, withTaps } from '../../core/typed';

/**
 * Slider gadget with typed commands
 */
export type SliderState = {
  value: number;
  min: number;
  max: number;
  step: number;
};

export type SliderCommands =
  | { set: number }
  | { increment: {} }
  | { decrement: {} }
  | { configure: { min?: number; max?: number; step?: number } };

export type SliderSpec = & State<SliderState>
  & Input<SliderCommands>
  & Actions<
    {
      set: number;
      increment: {};
      decrement: {};
      configure: { min?: number; max?: number; step?: number };
      ignore: {};
    }>
  & Effects<{
    changed: number;
    configured: SliderState;
    noop: {};
  }
  >;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const sliderGadget = (
  initial: number = 50,
  min: number = 0,
  max: number = 100,
  step: number = 1
) => {
  const baseGadget = defGadget<SliderSpec>({
    dispatch: (state, command) => {
      if ('set' in command) {
        const newValue = clamp(command.set, state.min, state.max);
        if (newValue !== state.value) {
          return { set: command.set };
        }
        return { ignore: {} };
      }
      if ('increment' in command) {
        if (state.value + state.step <= state.max) {
          return { increment: {} };
        }
        return { ignore: {} };
      }
      if ('decrement' in command) {
        if (state.value - state.step >= state.min) {
          return { decrement: {} };
        }
        return { ignore: {} };
      }
      if ('configure' in command) {
        return { configure: command.configure };
      }
      return { ignore: {} };
    },
    methods: {
      set: (gadget, value) => {
        const state = gadget.current();
        const clamped = clamp(value, state.min, state.max);
        const rounded = Math.round(clamped / state.step) * state.step;
        gadget.update({ ...state, value: rounded });
        return { changed: rounded };
      },
      increment: (gadget) => {
        const state = gadget.current();
        const newValue = Math.min(state.value + state.step, state.max);
        gadget.update({ ...state, value: newValue });
        return { changed: newValue };
      },
      decrement: (gadget) => {
        const state = gadget.current();
        const newValue = Math.max(state.value - state.step, state.min);
        gadget.update({ ...state, value: newValue });
        return { changed: newValue };
      },
      configure: (gadget, config) => {
        const state = gadget.current();
        const newState = {
          ...state,
          min: config.min ?? state.min,
          max: config.max ?? state.max,
          step: config.step ?? state.step,
        };
        // Re-clamp value to new bounds
        newState.value = clamp(state.value, newState.min, newState.max);
        gadget.update(newState);
        return newState.value !== state.value
          ? { changed: newState.value, configured: newState }
          : { configured: newState };
      },
      ignore: () => ({ noop: {} })
    }
  })({ value: initial, min, max, step });

  return withTaps(baseGadget);
};

/**
 * Meter gadget - displays values
 */
export type MeterState = {
  value: number;
  min: number;
  max: number;
  label: string | undefined;
};

export type MeterCommands =
  | { display: number }
  | { configure: { min?: number; max?: number; label?: string } }
  | { reset: {} };

export type MeterSpec = & State<MeterState>
  & Input<MeterCommands>
  & Actions<
    {
      display: number;
      configure: { min?: number; max?: number; label?: string };
      reset: {};
      ignore: {};
    }>
  & Effects<{
    changed: number;
    configured: MeterState;
    noop: {};
  }
  >;

export const meterGadget = (
  min: number = 0,
  max: number = 100,
  label?: string
) => {
  const baseGadget = defGadget<MeterSpec>({
    dispatch: (state, command) => {
      if ('display' in command) {
        const clamped = clamp(command.display, state.min, state.max);
        if (clamped !== state.value) {
          return { display: clamped };
        }
        return { ignore: {} };
      }
      if ('configure' in command) {
        return { configure: command.configure };
      }
      if ('reset' in command) {
        return { reset: {} };
      }
      return { ignore: {} };
    },
    methods: {
      display: (gadget, value) => {
        const state = gadget.current();
        gadget.update({ ...state, value });
        return { changed: value };
      },
      configure: (gadget, config) => {
        const state = gadget.current();
        const newState = {
          ...state,
          min: config.min ?? state.min,
          max: config.max ?? state.max,
          label: config.label ?? state.label,
        };
        // Re-clamp value
        newState.value = clamp(state.value, newState.min, newState.max);
        gadget.update(newState);
        return { configured: newState };
      },
      reset: (gadget) => {
        const state = gadget.current();
        const resetValue = state.min;
        gadget.update({ ...state, value: resetValue });
        return { changed: resetValue };
      },
      ignore: () => ({ noop: {} })
    }
  })({ value: min, min, max, label });

  return withTaps(baseGadget);
};

/**
 * Toggle gadget - simple on/off switch
 */
export type ToggleState = {
  on: boolean;
  label?: string;
};

export type ToggleCommands =
  | { toggle: {} }
  | { set: boolean }
  | { configure: { label?: string } };

export type ToggleSpec = & State<ToggleState>
  & Input<ToggleCommands>
  & Actions<
    {
      set: boolean;
      configure: { label?: string };
      ignore: {};
    }>
  & Effects<{
    changed: ToggleState;
    toggled: boolean;
    configured: ToggleState;
    noop: {};
  }>;

export const toggleGadget = (initial: boolean = false, label?: string) => {
  const baseGadget = defGadget<ToggleSpec>({
    dispatch: (state, command) => {
      if ('toggle' in command) {
        console.log('Toggling toggle gadget, state:', state, 'command:', command);
        return { set: state.on ? false : true };
      }
      if ('set' in command) {
        if (command.set !== state.on) {
          return { set: command.set };
        }
        return { ignore: {} };
      }
      if ('configure' in command) return { configure: command.configure };
      console.log('Ignoring command:', command);
      return { ignore: {} };
    },
    methods: {
      set: (gadget, value) => {
        const state = gadget.current();
        if (value !== state.on) {
          const newState = { ...state, on: value };
          gadget.update(newState);
          console.log('State:', state);
          console.log('Setting toggle gadget to:', value);
          return { changed: newState, toggled: value };
        } else {
          console.log('Ignoring set command:', value, 'state:', state);
          return { ignore: {} };
        }
      },
      configure: (gadget, config) => {
        const state = gadget.current();
        const newState = {
          ...state,
          ...config
        };
        gadget.update(newState);
        return { configured: newState };
      },
      ignore: () => ({ noop: {} })
    }
  })({ on: initial, label: label ?? '' });

  return withTaps(baseGadget);
};