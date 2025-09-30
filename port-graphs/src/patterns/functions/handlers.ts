import { Arrow, Gadget, EffectsOf, Handler } from '../../core/context';

// ================================================
// Function Handlers
// ================================================

export const fnHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'merge' in effects) g.update(effects.merge);
    // computed/changed/noop are metadata for taps
  };