/**
 * Counter node gadget specification
 */

import { defGadget, withTaps } from 'port-graphs';
import type { GadgetSpec, TypedGadget } from 'port-graphs';
import type { NodeGadgets, LabelSpec, PortSpec, StyleSpec } from '../visual/types';

/**
 * Counter logic specification
 */
export interface CounterSpec extends GadgetSpec<
  { count: number },
  { increment: {} } | { decrement: {} } | { reset: {} },
  {
    increment: {};
    decrement: {};
    reset: {};
  },
  {
    changed: number;
    incremented: number;
    decremented: number;
    reset: {};
  }
> {}

/**
 * Counter node gadgets type
 */
export type CounterNodeGadgets = NodeGadgets<LabelSpec, PortSpec, CounterSpec, StyleSpec>;

/**
 * Counter node specification
 */
export const counterNodeSpecs: CounterNodeGadgets = {
  label: {
    state: { text: 'Counter' },
    input: {} as { setText: string },
    effects: {} as { changed: string }
  },
  ports: {
    state: {
      inputs: [],
      outputs: [{ id: 'count', name: 'Count', type: 'number' }]
    },
    input: {} as Partial<{ inputs: any[]; outputs: any[] }>,
    effects: {} as { changed: any; portAdded: any; portRemoved: string }
  },
  logic: {
    state: { count: 0 },
    input: {} as CounterSpec['input'],
    actions: {
      increment: {},
      decrement: {},
      reset: {}
    },
    effects: {} as CounterSpec['effects']
  },
  style: {
    state: { backgroundColor: '#f0f0f0', borderColor: '#333' },
    input: {} as { setStyle: any },
    effects: {} as { changed: any }
  }
};

/**
 * Creates a counter gadget
 */
export function createCounterGadget(initial = 0) {
  const gadget = defGadget<CounterSpec>(
    (state, command) => {
      if ('increment' in command) {
        return { increment: {} };
      }
      if ('decrement' in command) {
        return { decrement: {} };
      }
      if ('reset' in command) {
        return { reset: {} };
      }
      return null;
    },
    {
      increment: (gadget) => {
        const state = gadget.current();
        const newCount = state.count + 1;
        gadget.update({ count: newCount });
        return {
          changed: newCount,
          incremented: newCount
        };
      },
      decrement: (gadget) => {
        const state = gadget.current();
        const newCount = state.count - 1;
        gadget.update({ count: newCount });
        return {
          changed: newCount,
          decremented: newCount
        };
      },
      reset: (gadget) => {
        gadget.update({ count: 0 });
        return {
          changed: 0,
          reset: {}
        };
      }
    }
  )({ count: initial });

  return withTaps(gadget);
}