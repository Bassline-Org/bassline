/**
 * Example using the new object-based action/effect pattern
 */

import { defGadgetTyped, type ActionResult, type EffectResult } from '../../core/typed';
import type { GadgetSpec } from '../../core/types';

// Define a counter spec with object-based actions and effects
type CounterSpec = GadgetSpec<
  number,  // State
  'inc' | 'dec' | 'reset',  // Input
  {
    update: number;
    skip: {};
  },  // Actions
  {
    changed: { value: number };
    noop: {};
  }  // Effects
>;

// Create a typed counter gadget
export const createCounter = (initial: number) => {
  return defGadgetTyped<CounterSpec>(
    // Consider function - returns single-key object
    (state, input): ActionResult<CounterSpec['actions']> | null => {
      switch (input) {
        case 'inc':
          return { update: state + 1 };
        case 'dec':
          return { update: state - 1 };
        case 'reset':
          return { update: 0 };
        default:
          return { skip: {} };
      }
    },
    // Action handlers - each gets its exact context type
    {
      update: (gadget, newValue) => {
        // TypeScript knows newValue is number
        gadget.update(newValue);
        return { changed: { value: newValue } };
      },
      skip: () => {
        // TypeScript knows context is {}
        return { noop: {} };
      }
    }
  )(initial);
};

// Test type safety
const counter = createCounter(0);

// These work
counter.receive('inc');
counter.receive('dec');
counter.receive('reset');

// This would error if uncommented:
// counter.receive('wrong');  // Type error!

const value: number = counter.current();  // TypeScript knows this is a number

// Max cell example
type MaxCellSpec = GadgetSpec<
  number,
  number,
  {
    update: { value: number };
    ignore: {};
  },
  {
    changed: { value: number };
    noop: {};
  }
>;

export const createMaxCell = (initial: number) => {
  return defGadgetTyped<MaxCellSpec>(
    (state, input) => {
      if (input > state) {
        return { update: { value: input } };
      }
      return { ignore: {} };
    },
    {
      update: (gadget, context) => {
        // TypeScript knows context is { value: number }
        gadget.update(context.value);
        return { changed: { value: context.value } };
      },
      ignore: () => {
        return { noop: {} };
      }
    }
  )(initial);
};