import { createGadget } from "../../core";
import { changed, contradiction } from "../../effects";
import _ from "lodash";

/**
 * Set operations using arrays with lodash
 * Arrays work better for serialization than native Sets
 */

export const unionCell = createGadget<any[], any[]>(
  (current, incoming) => {
    // Use lodash union which handles arrays
    const result = _.union(current, incoming);
    if (result.length === current.length) {
      return null; // No new elements
    }
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);

export const intersectionCell = createGadget<any[], any[]>(
  (current, incoming) => {
    const result = _.intersection(current, incoming);
    if (result.length === 0 && current.length > 0) {
      return { action: 'contradiction', context: { current, incoming } };
    }
    if (_.isEqual(result, current)) {
      return null; // No change
    }
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    },
    'contradiction': (_gadget, { current, incoming }) => {
      return contradiction(current, incoming);
    }
  }
);

export const differenceCell = createGadget<any[], any[]>(
  (current, incoming) => {
    const result = _.difference(current, incoming);
    if (_.isEqual(result, current)) {
      return null; // No change
    }
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);