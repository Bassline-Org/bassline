/**
 * React integration for port-graphs gadgets
 *
 * This package provides hooks and utilities for seamlessly integrating
 * gadgets with React components, using React state as the single source of truth.
 */

import { Gadget, replaceSemantics } from 'port-graphs';
import { useEffect, useRef, useState } from 'react';

export { useGadget } from './useGadget';

export {
  useGadgetEffect,
  useGadgetEmissions,
  useGadgetConnection,
} from './useGadgetEffect';
export type { EffectHandler } from './useGadgetEffect';

// Topic routing
export { TopicsProvider, useTopics } from './TopicsProvider';

// Re-export core gadget types for convenience
export type { Gadget } from 'port-graphs';
