import { createGadget } from "../../core";
import { changed, contradiction } from "../../effects";

export const unionCell = createGadget<Set<any>, Set<any>>(
  (current, incoming) => {
    // Quick size check first
    if (incoming.size === 0 || incoming.isSubsetOf(current)) {
      return null; // No action needed
    }
    // Compute the union once
    const result = current.union(incoming);
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);

export const intersectionCell = createGadget<Set<any>, Set<any>>(
  (current, incoming) => {
    // Compute intersection once
    const overlap = current.intersection(incoming);

    if (overlap.size === 0) {
      return { action: 'contradiction', context: { current, incoming } };
    }
    if (overlap.size === current.size) {
      return null; // No change needed
    }
    return { action: 'merge', context: { result: overlap } };
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