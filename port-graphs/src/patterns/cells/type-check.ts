/**
 * Quick type checking to verify inference works
 */

import { createGadgetTyped } from '../../core/typed';

// Simple counter with explicit action types
const counter = createGadgetTyped<
  number,
  'inc' | 'dec',
  | { action: 'add'; context: number }
  | { action: 'skip' },
  { changed: number } | { noop: true }
>(
  (state, input) => {
    if (input === 'inc') return { action: 'add', context: 1 };
    if (input === 'dec') return { action: 'add', context: -1 };
    return { action: 'skip' };
  },
  {
    add: (gadget, delta) => {
      const newValue = gadget.current() + delta;
      gadget.update(newValue);
      return { changed: newValue };
    },
    skip: () => ({ noop: true })
  }
)(0);

// Test that types flow through properly
const c = counter;

// These should work
c.receive('inc');
c.receive('dec');
const val: number = c.current();
c.emit({ changed: 42 });
c.emit({ noop: true });

// These should error if uncommented:
// c.receive('wrong');  // Error: Argument of type '"wrong"' is not assignable
// c.receive(123);      // Error: Argument of type 'number' is not assignable
// c.emit({ wrong: true }); // Error: Argument of type '{ wrong: boolean; }' is not assignable
// const str: string = c.current(); // Error: Type 'number' is not assignable to type 'string'

console.log('Type checking passed!', val);