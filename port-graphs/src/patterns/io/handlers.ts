/**
 * IO Pattern Handlers - Effect interpretation for IO operations
 */

import { Arrow, Gadget, EffectsOf, Handler } from '../../core/context';

/**
 * Standard IO handler - handles merge and error effects
 */
export const ioHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'merge' in effects) {
      g.update(effects.merge);
    }
    // Other effects (saved, loaded, cleared, error, etc.) are metadata for taps
  };

/**
 * FileReader handler - handles async file reading
 * This is more complex because FileReader is inherently async
 */
export const fileReaderHandler = <Step extends Arrow>(): Handler<Step> =>
  (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    // Handle merge for state updates
    if (effects && 'merge' in effects) {
      g.update(effects.merge);
    }

    // Handle async file reading - emit effects when done
    // Note: The step should NOT handle the async part, that's the handler's job
    // For file reading, we need special handling in the step or a different approach
  };
