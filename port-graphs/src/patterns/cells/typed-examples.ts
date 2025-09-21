/**
 * Testing type-safe gadget creation with simple cell examples
 */

import { createGadgetTyped, fromSpec } from '../../core/typed';
import {
  type GadgetSpec,
  type ChangedEffect,
  type NoopEffect,
  type BasicActions,
  type UpdateAction,
  type IgnoreAction
} from '../../core/types';

// Test 1: MaxCell with explicit types
type MaxCellState = number;
type MaxCellInput = number;
type MaxCellActions =
  | { action: 'update'; context: { value: number } }
  | { action: 'ignore' };
type MaxCellEffect = ChangedEffect<number> | NoopEffect;

export const maxCellTyped = (initial: number) => {
  return createGadgetTyped<MaxCellState, MaxCellInput, MaxCellActions, MaxCellEffect>(
    (state, input) => {
      if (input > state) {
        return { action: 'update' as const, context: { value: input } };
      }
      return { action: 'ignore' as const };
    },
    {
      update: (gadget, context) => {
        // TypeScript knows context is { value: number }
        gadget.update(context.value);
        return { changed: context.value };
      },
      ignore: () => {
        // No context for ignore
        return { noop: true };
      }
    }
  )(initial);
};

// Test 2: LastCell using spec
type LastCellSpec = GadgetSpec<
  number,  // State
  number,  // Input
  BasicActions<{ value: number }>,  // Actions
  ChangedEffect<number> | NoopEffect  // Effect
>;

export const lastCellTyped = (initial: number) => {
  return fromSpec<LastCellSpec>(
    (state, input) => {
      if (input !== state) {
        return { action: 'update', context: { value: input } };
      }
      return { action: 'ignore' };
    },
    {
      update: (gadget, context) => {
        gadget.update(context.value);
        return { changed: context.value };
      },
      ignore: () => ({ noop: true })
    }
  )(initial);
};

// Test 3: MinCell with union state
type MinCellState = number | null;
type MinCellActions =
  | { action: 'first'; context: { value: number } }
  | { action: 'update'; context: { value: number } }
  | { action: 'ignore' };

export const minCellTyped = (initial?: number) => {
  return createGadgetTyped<MinCellState, number, MinCellActions, ChangedEffect<number> | NoopEffect>(
    (state, input) => {
      if (state === null || state === undefined) {
        return { action: 'first' as const, context: { value: input } };
      }
      if (input < state) {
        return { action: 'update' as const, context: { value: input } };
      }
      return { action: 'ignore' as const };
    },
    {
      first: (gadget, context) => {
        gadget.update(context.value);
        return { changed: context.value };
      },
      update: (gadget, context) => {
        gadget.update(context.value);
        return { changed: context.value };
      },
      ignore: () => ({ noop: true })
    }
  )(initial ?? null);
};

// Test 4: Counter with multiple input types
type CounterInput =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }
  | { type: 'set'; value: number };

type CounterActions =
  | { action: 'add'; context: { delta: number } }
  | { action: 'reset'; context: { value: number } }
  | { action: 'ignore' };

export const counterTyped = (initial = 0) => {
  return createGadgetTyped<number, CounterInput, CounterActions, ChangedEffect<number> | NoopEffect>(
    (state, input) => {
      switch (input.type) {
        case 'increment':
          return { action: 'add' as const, context: { delta: 1 } };
        case 'decrement':
          return { action: 'add' as const, context: { delta: -1 } };
        case 'reset':
          return { action: 'reset' as const, context: { value: 0 } };
        case 'set':
          return { action: 'reset' as const, context: { value: input.value } };
        default:
          return { action: 'ignore' as const };
      }
    },
    {
      add: (gadget, context) => {
        const newValue = gadget.current() + context.delta;
        gadget.update(newValue);
        return { changed: newValue };
      },
      reset: (gadget, context) => {
        gadget.update(context.value);
        return { changed: context.value };
      },
      ignore: () => ({ noop: true })
    }
  )(initial);
};

// Test that type errors work (uncomment to verify):
/*
// Should error: returning unknown action
const badAction = createGadgetTyped<number, number, { action: 'update' }, any>(
  (state, input) => {
    return { action: 'unknown' as const }; // Error: Type '"unknown"' is not assignable
  },
  { update: () => null }
);

// Should error: wrong context type
const badContext = createGadgetTyped<number, number, { action: 'update'; context: { value: number } }, any>(
  (state, input) => {
    return { action: 'update' as const, context: { wrong: 'type' } }; // Error: Type '{ wrong: string }' is not assignable
  },
  { update: () => null }
);

// Should error: missing action handler
const missingAction = createGadgetTyped<number, number, { action: 'update' } | { action: 'ignore' }, any>(
  (state, input) => ({ action: 'update' as const }),
  {
    // Error: Property 'ignore' is missing
    update: () => null
  }
);
*/