/**
 * Display node gadget specification
 */

import { defGadget, withTaps } from 'port-graphs';
import type { GadgetSpec } from 'port-graphs';
import type { NodeGadgets, LabelSpec, PortSpec, StyleSpec } from '../visual/types';

/**
 * Display logic specification
 */
export interface DisplaySpec extends GadgetSpec<
  { value: string | number | null },
  { display: string | number },
  {
    display: string | number;
    clear: {};
  },
  {
    changed: string | number | null;
    displayed: string | number;
    cleared: {};
  }
> {}

/**
 * Display node gadgets type
 */
export type DisplayNodeGadgets = NodeGadgets<LabelSpec, PortSpec, DisplaySpec, StyleSpec>;

/**
 * Display node specification
 */
export const displayNodeSpecs: DisplayNodeGadgets = {
  label: {
    state: { text: 'Display' },
    input: {} as { setText: string },
    effects: {} as { changed: string }
  },
  ports: {
    state: {
      inputs: [{ id: 'value', name: 'Value', type: 'any' }],
      outputs: []
    },
    input: {} as Partial<{ inputs: any[]; outputs: any[] }>,
    effects: {} as { changed: any; portAdded: any; portRemoved: string }
  },
  logic: {
    state: { value: null },
    input: {} as DisplaySpec['input'],
    actions: {
      display: '' as string | number,
      clear: {}
    },
    effects: {} as DisplaySpec['effects']
  },
  style: {
    state: { backgroundColor: '#e8f4f8', borderColor: '#0066cc' },
    input: {} as { setStyle: any },
    effects: {} as { changed: any }
  }
};

/**
 * Creates a display gadget
 */
export function createDisplayGadget(initial: string | number | null = null) {
  const gadget = defGadget<DisplaySpec>(
    (_state, command) => {
      if ('display' in command) {
        return { display: command.display };
      }
      return null;
    },
    {
      display: (gadget, value) => {
        gadget.update({ value });
        return {
          changed: value,
          displayed: value
        };
      },
      clear: (gadget) => {
        gadget.update({ value: null });
        return {
          changed: null,
          cleared: {}
        };
      }
    }
  )({ value: initial });

  return withTaps(gadget);
}