/**
 * Example using the new object-based action/effect pattern
 */

import _ from 'lodash';
import { defGadget, type ActionResult, type EffectResult } from '../../core/typed';

type CrudInput<T = unknown> =
  | { create: T }
  | { read: T }
  | { update: T }
  | { delete: T };

type CrudSpec<T> = {
  state: T[];
  input: CrudInput<T>;
  actions: {
    add: T;
    delete: T;
  },
  effects: {
    changed: { newValue: T[], added: T[], removed: T[] }
  }
};

const crudExample = defGadget<CrudSpec<number>>(
  (state, input) => {
    if ('create' in input || 'update' in input) {
      const value = 'create' in input ? input.create : input.update;
      if (_.includes(state, value)) {
        return null;
      }
      return { add: value };
    }
    if ('delete' in input) {
      const value = input.delete;
      if (!_.includes(state, value)) {
        return null;
      }
      return { delete: value };
    }
    return null;
  },
  {
    add: (gadget, value) => {
      gadget.update([...gadget.current(), value]);
      return { changed: { newValue: gadget.current(), added: [value], removed: [] } };
    },
    delete: (gadget, value) => {
      gadget.update(gadget.current().filter(x => x !== value));
      return { changed: { newValue: gadget.current(), added: [], removed: [value] } };
    },
  }
)

// Define a counter spec with object-based actions and effects
type CounterSpec = {
  state: number,  // State
  input: 'inc' | 'dec' | 'reset',  // Input
  actions: {
    update: number;
    skip: {};
  },  // Actions
  effects: {
    changed: { value: number };
    noop: {};
  }  // Effects
};

// Create a typed counter gadget
export const createCounter = (initial: number) => {
  return defGadget<CounterSpec>(
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
type MaxCellSpec = {
  state: number,
  input: number,
  actions: {
    update: { value: number };
    ignore: {};
  },
  effects: {
    changed: { value: number };
    noop: {};
  }
};

export const createMaxCell = (initial: number) => {
  return defGadget<MaxCellSpec>(
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