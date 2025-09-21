/**
 * Test that our type-safe gadget system actually prevents errors
 */

import { defGadgetTyped } from '../../core/typed';
import type { GadgetSpec } from '../../core/types';

// Define a spec
type TestSpec = GadgetSpec<
  number,
  'add' | 'multiply',
  {
    update: number,
  },
  {
    updated: number;
    error: { msg: string };
  }
>;

const testGadget = defGadgetTyped<TestSpec>(
  (state, input) => {
    if (input === 'add') return { update: state + 1 };
    if (input === 'multiply') return { update: state * 2 };
    return null;
  },
  {
    update: (gadget, newValue) => {
      gadget.update(newValue);
      return { updated: newValue };
    },
  }
);

// Test usage
const g = testGadget(0);
g.receive('add');
g.receive('multiply');

// These would error if uncommented:
// g.receive('wrong');  // Error: not a valid input
// g.receive(123);      // Error: wrong type

const val: number = g.current();  // Works!
// const str: string = g.current();  // Error: Type 'number' is not assignable to type 'string'

console.log("Type safety verified!", val);