import { createGadget } from "../../core";
import { changed } from "../../effects";
import { isEqual } from 'lodash';

/**
 * A cell that always updates to the last value received,
 * but only if it's different from the current value
 * Uses deep equality for objects
 */
export const lastCell = createGadget<any, any>(
  (current, incoming) => {
    // Check deep equality for objects, shallow for primitives
    if (isEqual(current, incoming)) {
      return null; // No action needed
    }
    return { action: 'update', context: { value: incoming } };
  },
  {
    'update': (gadget, { value }) => {
      gadget.update(value);
      return changed(value);
    }
  }
);