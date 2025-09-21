/**
 * Test file to verify type inference and safety
 */

import { createGadgetTyped, fromSpec, type TypedGadget } from '../../core/typed';
import { type GadgetSpec, type ChangedEffect, type NoopEffect } from '../../core/types';

// Test 1: Direct typed creation
type CounterActions =
  | { action: 'increment'; context: { by: number } }
  | { action: 'decrement'; context: { by: number } }
  | { action: 'reset' }
  | { action: 'ignore' };

const createCounter = (initial: number) => {
  return createGadgetTyped<number, { type: 'inc' | 'dec' | 'reset' }, CounterActions, ChangedEffect<number> | NoopEffect>(
    (state, input) => {
      switch (input.type) {
        case 'inc': return { action: 'increment' as const, context: { by: 1 } };
        case 'dec': return { action: 'decrement' as const, context: { by: 1 } };
        case 'reset': return { action: 'reset' as const };
        default: return { action: 'ignore' as const };
      }
    },
    {
      increment: (gadget, context) => {
        const newValue = gadget.current() + context.by;
        gadget.update(newValue);
        return { changed: newValue };
      },
      decrement: (gadget, context) => {
        const newValue = gadget.current() - context.by;
        gadget.update(newValue);
        return { changed: newValue };
      },
      reset: (gadget) => {
        gadget.update(0);
        return { changed: 0 };
      },
      ignore: () => ({ noop: true })
    }
  )(initial);
};

// Test 2: Spec-driven creation
type ToggleSpec = GadgetSpec<
  boolean,
  'toggle' | 'set',
  | { action: 'flip' }
  | { action: 'setValue'; context: boolean }
  | { action: 'noop' },
  ChangedEffect<boolean> | NoopEffect
>;

const createToggle = (initial: boolean) => {
  return fromSpec<ToggleSpec>(
    (state, input) => {
      if (input === 'toggle') return { action: 'flip' as const };
      if (input === 'set') return { action: 'setValue' as const, context: !state };
      return { action: 'noop' as const };
    },
    {
      flip: (gadget) => {
        const newValue = !gadget.current();
        gadget.update(newValue);
        return { changed: newValue };
      },
      setValue: (gadget, context) => {
        gadget.update(context);
        return { changed: context };
      },
      noop: () => ({ noop: true })
    }
  )(initial);
};

// Test usage and type inference
export function testTypeInference() {
  const counter = createCounter(0);
  const toggle = createToggle(false);

  // These should be properly typed
  counter.receive({ type: 'inc' });
  counter.receive({ type: 'dec' });
  counter.receive({ type: 'reset' });

  toggle.receive('toggle');
  toggle.receive('set');

  // Get current values - should be typed
  const count: number = counter.current();
  const isOn: boolean = toggle.current();

  // Test effects
  counter.emit({ changed: 42 });
  counter.emit({ noop: true });

  toggle.emit({ changed: true });
  toggle.emit({ noop: true });

  // These should cause type errors if uncommented:
  // counter.receive('wrong');  // Error: wrong input type
  // counter.emit({ wrong: true });  // Error: wrong effect type
  // toggle.receive(123);  // Error: wrong input type
  // const wrongType: string = counter.current();  // Error: wrong state type

  return { counter, toggle, count, isOn };
}

// Export the creators for use elsewhere
export { createCounter, createToggle };