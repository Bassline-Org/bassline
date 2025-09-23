/**
 * Factory for creating node instances from specs
 */

import { defGadget, withTaps, lastMap } from 'port-graphs';
import type { TypedGadget, PartialSpec } from 'port-graphs';
import type {
  NodeGadgets,
  NodeInstance,
  CounterNodeInstance,
  DisplayNodeInstance,
  LabelSpec,
  PortSpec,
  StyleSpec,
  Port
} from './types';
import { createCounterGadget } from '../nodes/counter-node';
import { createDisplayGadget } from '../nodes/display-node';
import type { CounterSpec } from '../nodes/counter-node';
import type { DisplaySpec } from '../nodes/display-node';

/**
 * Creates a label gadget
 */
function createLabelGadget(initial = 'Node'): TypedGadget<LabelSpec> {
  return lastMap({ text: initial }) as TypedGadget<LabelSpec>;
}

/**
 * Creates a port gadget
 */
function createPortGadget(initial: { inputs: Port[]; outputs: Port[] }): TypedGadget<PortSpec> {
  return lastMap(initial) as TypedGadget<PortSpec>;
}

/**
 * Creates a style gadget
 */
function createStyleGadget(initial: {
  color?: string;
  borderRadius?: number;
  backgroundColor?: string;
  borderColor?: string;
}): TypedGadget<StyleSpec> {
  return lastMap(initial) as TypedGadget<StyleSpec>;
}

// Logic gadget creation is now handled in specific factory functions

// Removed generic createNodeFromSpecs - use specific factories instead

/**
 * Creates a counter node instance with proper typing
 */
export function createCounterNode(id: string, initialCount = 0): CounterNodeInstance {
  return {
    type: 'counter',
    id,
    gadgets: {
      label: createLabelGadget('Counter'),
      ports: createPortGadget({
        inputs: [],
        outputs: [{ id: 'count', name: 'Count', type: 'number' }]
      }),
      logic: createCounterGadget(initialCount),
      style: createStyleGadget({ backgroundColor: '#f0f0f0', borderColor: '#333' })
    }
  };
}

/**
 * Creates a display node instance with proper typing
 */
export function createDisplayNode(id: string, initialValue: string | number | null = null): DisplayNodeInstance {
  return {
    type: 'display',
    id,
    gadgets: {
      label: createLabelGadget('Display'),
      ports: createPortGadget({
        inputs: [{ id: 'value', name: 'Value', type: 'any' }],
        outputs: []
      }),
      logic: createDisplayGadget(initialValue),
      style: createStyleGadget({ backgroundColor: '#e8f4f8', borderColor: '#0066cc' })
    }
  };
}