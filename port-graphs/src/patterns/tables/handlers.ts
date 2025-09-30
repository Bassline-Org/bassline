import { Arrow, Gadget, EffectsOf, Handler } from '../../core/context';
import { mergeHandler } from '../cells';

// ================================================
// Table Handlers
// ================================================

// Table handler - interprets merge with metadata
export const tableHandler = mergeHandler;

// Family handler - forwards sends to child gadgets
export const familyHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'merge' in effects) g.update(effects.merge);
    if (effects && 'send' in effects) {
      const state = g.current();
      const sends = effects.send as Record<PropertyKey, unknown>;
      for (const [key, value] of Object.entries(sends)) {
        const gadget = state[key];
        if (gadget && typeof gadget === 'object' && 'receive' in gadget) {
          (gadget as { receive: (v: unknown) => void }).receive(value);
        }
      }
    }
  };