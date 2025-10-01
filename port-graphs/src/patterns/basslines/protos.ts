/**
 * Network Bassline Proto - Composed Handler
 */

import { protoGadget } from '../../core/context';
import { networkStep } from './steps';
import {
  defineHandler,
  spawnHandler,
  wireHandler,
  destroyHandler,
  toggleHandler,
  errorHandler,
} from './handlers';

// ================================================
// Proto-Gadget (Composed from Small Handlers)
// ================================================

export const networkProto = () =>
  protoGadget(networkStep).handler((g, actions) => ({
    ...defineHandler(g, actions),
    ...spawnHandler(g, actions),
    ...wireHandler(g, actions),
    ...destroyHandler(g, actions),
    ...toggleHandler(g, actions),
    ...errorHandler(g, actions),
  }));
