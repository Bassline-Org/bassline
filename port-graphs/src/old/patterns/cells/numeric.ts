/**
 * Old numeric cell patterns (DEPRECATED - use typed-cells instead)
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../../effects';

export const maxCell = (initial: number) => createGadget<number, number>(
  (current, incoming) => {
    if (incoming > current) {
      return { action: 'merge', context: incoming };
    }
    return null;
  },
  {
    merge: (gadget, value) => {
      gadget.update(value);
      return changed(value);
    }
  }
)(initial);

export const minCell = (initial: number) => createGadget<number, number>(
  (current, incoming) => {
    if (incoming < current) {
      return { action: 'merge', context: incoming };
    }
    return null;
  },
  {
    merge: (gadget, value) => {
      gadget.update(value);
      return changed(value);
    }
  }
)(initial);