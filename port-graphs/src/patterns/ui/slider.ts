/**
 * Slider gadget - a UI control that follows the gadget protocol
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';

interface SliderState {
  value: number;
  min: number;
  max: number;
  step: number;
}

type SliderInput =
  | { type: 'set', value: number }
  | { type: 'drag', value: number }
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'configure', min?: number, max?: number, step?: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const sliderGadget = (initial: number, min = 0, max = 100, step = 1) => {
  return createGadget<SliderState, SliderInput>(
    (state, input) => {
      // CONSIDER: What should we do with this input?
      switch (input.type) {
        case 'set':
        case 'drag':
          // Accept value changes if within bounds
          const newValue = clamp(input.value, state.min, state.max);
          if (newValue !== state.value) {
            return {
              action: 'update',
              context: { value: newValue, state }
            };
          }
          return null;

        case 'increment':
          if (state.value + state.step <= state.max) {
            return {
              action: 'increment',
              context: { state }
            };
          }
          return null;

        case 'decrement':
          if (state.value - state.step >= state.min) {
            return {
              action: 'decrement',
              context: { state }
            };
          }
          return null;

        case 'configure':
          return {
            action: 'configure',
            context: { input, state }
          };

        default:
          return null;
      }
    },
    {
      // ACT: Perform the action decided in consider
      'update': (gadget, context) => {
        const { value, state } = context;
        const rounded = Math.round(value / state.step) * state.step;
        gadget.update({ ...state, value: rounded });
        return changed(rounded);
      },

      'increment': (gadget, context) => {
        const { state } = context;
        const newValue = Math.min(state.value + state.step, state.max);
        gadget.update({ ...state, value: newValue });
        return changed(newValue);
      },

      'decrement': (gadget, context) => {
        const { state } = context;
        const newValue = Math.max(state.value - state.step, state.min);
        gadget.update({ ...state, value: newValue });
        return changed(newValue);
      },

      'configure': (gadget, context) => {
        const { input, state } = context;
        const newState = { ...state };

        if (input.min !== undefined) newState.min = input.min;
        if (input.max !== undefined) newState.max = input.max;
        if (input.step !== undefined) newState.step = input.step;

        // Re-clamp current value to new bounds
        const newValue = clamp(state.value, newState.min, newState.max);
        newState.value = newValue;

        gadget.update(newState);

        if (newValue !== state.value) {
          return changed(newValue);
        }
        return noop();
      }
    })({ value: initial, min, max, step });
};