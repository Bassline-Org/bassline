/**
 * React integration for port-graphs gadgets
 *
 * This package provides hooks and utilities for seamlessly integrating
 * gadgets with React components, using React state as the single source of truth.
 */

export { useGadget, useGadgetWithRef } from './useGadget';
export type { GadgetFactory } from './useGadget';

export {
  useGadgetEffect,
  useGadgetEmissions,
  useGadgetConnection,
} from './useGadgetEffect';
export type { EffectHandler } from './useGadgetEffect';

// PubSub integration
export { PubSubProvider } from './PubSubProvider';
export { usePub, useSub, usePubSub } from './usePubSub';

// Re-export core gadget types for convenience
export type { Gadget } from '../../port-graphs/dist/core';