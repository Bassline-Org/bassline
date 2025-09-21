/**
 * Gadget type registry
 *
 * Maps type names to factory functions for instantiation
 */

import { GadgetRegistry } from './types';
import { maxCell, minCell } from '../patterns/cells/numeric';
import { unionCell as setUnionCell } from '../patterns/cells/set';
import { setCell } from '../patterns/cells/collections';
import { unionCell as arrayUnionCell } from '../patterns/cells/array-set';
import { lastCell } from '../patterns/cells/last';
import { firstMap, lastMap } from '../patterns/cells/maps';
import { createFn, binary } from '../patterns/functions';
import { pubsub } from '../patterns/meta/pubsub';
import { createGadget } from '../core';
import { changed, noop } from '../effects';

/**
 * Default registry of known gadget types
 */
export const defaultRegistry: GadgetRegistry = {
  // Numeric cells
  'maxCell': (initial = 0) => maxCell(initial),
  'minCell': (initial = 0) => minCell(initial),

  // Collection cells
  'unionCell': (initial = []) => arrayUnionCell(initial),
  'setUnionCell': (initial = new Set()) => setUnionCell(initial),
  'setCell': () => setCell(),
  'arrayUnionCell': (initial = []) => arrayUnionCell(initial),

  // Map cells
  'lastCell': (initial = {}) => lastCell(initial),
  'firstMap': (initial = {}) => firstMap(initial),
  'lastMap': (initial = {}) => lastMap(initial),

  // Functions
  'identity': () => createFn<{x: any}, any>((args) => args.x, ['x'])({}),
  'double': () => createFn<{x: number}, number>((args) => args.x * 2, ['x'])({}),
  'stringify': () => createFn<{x: any}, string>((args) => JSON.stringify(args.x), ['x'])({}),
  'parse': () => createFn<{x: string}, any>((args) => JSON.parse(args.x), ['x'])({}),

  // Binary functions
  'add': () => binary((a: number, b: number) => a + b)({}),
  'multiply': () => binary((a: number, b: number) => a * b)({}),
  'concat': () => binary((a: any, b: any) => [].concat(a, b))({}),

  // Meta gadgets
  'pubsub': (initial = {}) => {
    // Wrapper that handles string IDs and single topics
    const broker = pubsub(initial);
    const gadgetMap = new Map<string, any>();

    return createGadget<any, any>(
      (_state, data: any) => {
        if (data.subscribe) {
          return { action: 'subscribe', context: data.subscribe };
        }
        if (data.publish) {
          return { action: 'publish', context: data.publish };
        }
        if (data.registerGadget) {
          return { action: 'register', context: data.registerGadget };
        }
        return null;
      },
      {
        'subscribe': (_gadget, context) => {
          // Convert single topic to array and subscriber ID to gadget
          const topics = Array.isArray(context.topic) ? context.topic : [context.topic];
          const subscriberGadget = gadgetMap.get(context.subscriber);

          if (subscriberGadget) {
            broker.receive({ subscribe: { topics, source: subscriberGadget } });
          }
          return noop();
        },
        'publish': (_gadget, context) => {
          // Convert single topic to array
          const topics = Array.isArray(context.topic) ? context.topic : [context.topic];
          broker.receive({ publish: { topics, data: context.data } });
          return noop();
        },
        'register': (_gadget, context) => {
          // Store gadget reference by ID
          gadgetMap.set(context.id, context.gadget);
          return noop();
        }
      }
    )({});
  },

  // Logger gadget
  'logger': (initial: { prefix?: string } = {}) => {
    return createGadget(
      (_state, data) => ({ action: 'log', context: data }),
      {
        'log': (_gadget, data) => {
          const prefix = initial.prefix || '[LOG]';
          console.log(prefix, data);
          return noop();
        }
      }
    )({});
  },

  // Router gadget - routes based on predicates
  'router': (initial: { routes?: Array<{ match: any, to: string }> } = {}) => {
    return createGadget(
      (_state, data) => ({ action: 'route', context: data }),
      {
        'route': (_gadget, data) => {
          const routes = initial.routes || [];
          for (const route of routes) {
            // Simple equality for now, could be extended
            if (JSON.stringify(data) === JSON.stringify(route.match)) {
              return changed({ [route.to]: data });
            }
          }
          return noop();
        }
      }
    )({ routes: initial.routes || [] });
  },

  // Pass-through gadget (useful for debugging/tapping)
  'tap': (initial: { label?: string } = {}) => {
    return createGadget(
      (_state, data) => ({ action: 'tap', context: data }),
      {
        'tap': (_gadget, data) => {
          if (initial.label) {
            console.log(`[TAP:${initial.label}]`, data);
          }
          return changed(data); // Pass through unchanged
        }
      }
    )({});
  }
};

/**
 * Create a custom registry by extending the default
 */
export function createRegistry(custom: GadgetRegistry = {}): GadgetRegistry {
  return {
    ...defaultRegistry,
    ...custom
  };
}