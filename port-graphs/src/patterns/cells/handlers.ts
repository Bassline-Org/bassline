import { Arrow, Gadget, EffectsOf, Handler } from '../../core/context';

// ================================================
// Cell Handlers
// ================================================

// @goose: Handler for merging values
export const mergeHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'merge' in effects) g.update(effects.merge);
  };

// @goose: Handler for contradiction
export const contradictionHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'contradiction' in effects) {
      console.log('contradiction!', effects.contradiction);
    }
  };

// @goose: Compose multiple handlers into a single handler
export const composeHandlers = <Step extends Arrow>(
  ...handlers: Handler<Step>[]
): Handler<Step> => (g, effects) => {
  handlers.forEach(h => h(g, effects));
};