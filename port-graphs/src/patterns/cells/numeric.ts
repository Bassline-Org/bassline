import { createGadget } from "../../core";
import { changed } from "../../effects";

export const maxCell = createGadget<number, number>(
  (current, incoming) => {
    if (incoming > current) {
      return { action: 'merge', context: { result: incoming } };
    }
    return null; // No action needed
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);

export const minCell = createGadget<number, number>(
  (current, incoming) => {
    if (incoming < current) {
      return { action: 'merge', context: { result: incoming } };
    }
    return null; // No action needed
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);