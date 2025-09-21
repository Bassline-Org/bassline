/**
 * Meter gadget - displays values within a range
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';

interface MeterState {
  value: number;
  min: number;
  max: number;
  label: string | undefined;
}

type MeterInput = number | {
  value: number
} | {
  configure: {
    min?: number,
    max?: number,
    label?: string
  };
}

export const meterGadget = (min = 0, max = 100, label?: string) => {
  return createGadget<MeterState, MeterInput>(
    (state, input) => {
      // CONSIDER: How should we interpret this input?
      if (typeof input === 'number') {
        // Direct numeric value
        const clamped = Math.min(Math.max(input, state.min), state.max);
        if (clamped !== state.value) {
          return {
            action: 'update',
            context: { value: clamped, state }
          };
        }
        return null;
      } else {
        const action = 'configure' in input ? input['configure'] : input['value'];
      }
    },
    {
      'update': (gadget, context) => {
        const { value, state } = context;
        gadget.update({ ...state, value });
        return changed({ value, percentage: ((value - state.min) / (state.max - state.min)) * 100 });
      },

      'configure': (gadget, context) => {
        const { config, state } = context;
        const newState = { ...state };

        if (config.min !== undefined) newState.min = config.min;
        if (config.max !== undefined) newState.max = config.max;
        if (config.label !== undefined) newState.label = config.label;

        // Re-clamp value to new bounds
        const clamped = Math.min(Math.max(state.value, newState.min), newState.max);
        newState.value = clamped;

        gadget.update(newState);

        if (clamped !== state.value) {
          return changed({ value: clamped, percentage: ((clamped - newState.min) / (newState.max - newState.min)) * 100 });
        }
        return noop();
      }
    })({ value: min, min, max, label });
};