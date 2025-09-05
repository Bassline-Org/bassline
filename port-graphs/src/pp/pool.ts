/**
 * Pool gadget for semantic discovery and automatic wiring
 * 
 * A Pool accumulates assertions about what gadgets provide and need,
 * then automatically creates connections when matches are found.
 * This turns topology into data rather than infrastructure.
 */

import { protocol, Gadget } from "./core";
import { Action } from "./patterns";

/**
 * Assertion types that gadgets can make to the pool
 */
export interface Assertion {
  gadgetId: string;
  type: 'provides' | 'needs';
  tag: string;
  gadget?: Gadget<any>;
}

/**
 * Match found between provider and consumer
 */
export interface Match {
  tag: string;
  provider: {
    id: string;
    gadget?: Gadget<any>;
  };
  consumer: {
    id: string;
    gadget?: Gadget<any>;
  };
}

/**
 * Pool state accumulating assertions
 */
export interface PoolState {
  providers: Map<string, Set<Assertion>>;  // tag -> providers
  consumers: Map<string, Set<Assertion>>;  // tag -> consumers
  connections: Set<string>;  // Set of "providerId:consumerId:tag" strings to avoid duplicates
}

/**
 * Creates a Pool gadget that manages semantic discovery and wiring
 * 
 * Semantic: Accumulates assertions and creates connections on matches
 * Dependencies: Requires gadgets to provide references for wiring
 * 
 * @param act Action to perform when a match is found (typically creates wire)
 * @returns Protocol function for a pool gadget
 * 
 * @example
 * const pool = createPool((match) => {
 *   // Wire provider to consumer
 *   wire(match.provider.gadget, match.consumer.gadget);
 * });
 */
export function createPool<G extends Gadget<Assertion> = Gadget<Assertion>>(
  act: Action<Match, G>
): (this: G, data: Assertion) => void {
  const state: PoolState = {
    providers: new Map(),
    consumers: new Map(),
    connections: new Set()
  };

  return protocol<G, Assertion, Match[], Match[]>(
    // APPLY: Accumulate the assertion
    (assertion) => {
      const { type, tag } = assertion;
      
      if (type === 'provides') {
        if (!state.providers.has(tag)) {
          state.providers.set(tag, new Set());
        }
        state.providers.get(tag)!.add(assertion);
      } else {
        if (!state.consumers.has(tag)) {
          state.consumers.set(tag, new Set());
        }
        state.consumers.get(tag)!.add(assertion);
      }

      // Check for new matches
      const matches: Match[] = [];
      
      if (type === 'provides' && state.consumers.has(tag)) {
        // New provider, check existing consumers
        for (const consumer of state.consumers.get(tag)!) {
          const connectionKey = `${assertion.gadgetId}:${consumer.gadgetId}:${tag}`;
          if (!state.connections.has(connectionKey)) {
            state.connections.add(connectionKey);
            matches.push({
              tag,
              provider: { id: assertion.gadgetId, gadget: assertion.gadget },
              consumer: { id: consumer.gadgetId, gadget: consumer.gadget }
            });
          }
        }
      } else if (type === 'needs' && state.providers.has(tag)) {
        // New consumer, check existing providers
        for (const provider of state.providers.get(tag)!) {
          const connectionKey = `${provider.gadgetId}:${assertion.gadgetId}:${tag}`;
          if (!state.connections.has(connectionKey)) {
            state.connections.add(connectionKey);
            matches.push({
              tag,
              provider: { id: provider.gadgetId, gadget: provider.gadget },
              consumer: { id: assertion.gadgetId, gadget: assertion.gadget }
            });
          }
        }
      }

      return matches.length > 0 ? matches : null;
    },
    
    // CONSIDER: Are there new matches to wire?
    (matches) => matches && matches.length > 0 ? matches : null,
    
    // ACT: Create connections for each match
    (matches, gadget) => {
      for (const match of matches) {
        act(match, gadget);
      }
    }
  );
}

/**
 * Helper to create assertions
 */
export const assert = {
  /**
   * Create a "provides" assertion
   */
  provides: (gadgetId: string, tag: string, gadget?: Gadget<any>): Assertion => ({
    gadgetId,
    type: 'provides',
    tag,
    gadget
  }),

  /**
   * Create a "needs" assertion  
   */
  needs: (gadgetId: string, tag: string, gadget?: Gadget<any>): Assertion => ({
    gadgetId,
    type: 'needs',
    tag,
    gadget
  })
};

/**
 * Common pool actions
 */
export const poolActions = {
  /**
   * Log matches (for debugging)
   */
  logMatch: <G extends Gadget = Gadget>(): Action<Match, G> =>
    (match) => console.log(`Pool: Matched ${match.provider.id} -> ${match.consumer.id} for "${match.tag}"`),

  /**
   * Create direct wire between matched gadgets
   * Dependencies: Both gadgets must have receive methods
   */
  directWire: <G extends Gadget = Gadget>(): Action<Match, G> =>
    (match) => {
      if (match.provider.gadget && match.consumer.gadget) {
        // Create direct connection from provider to consumer
        const provider = match.provider.gadget;
        const consumer = match.consumer.gadget;
        
        // Wrap the original receive to intercept and forward
        const originalReceive = provider.receive?.bind(provider);
        if (originalReceive) {
          provider.receive = function(data: any) {
            originalReceive(data);
            // Forward to consumer
            consumer.receive(data);
          };
        }
      }
    },

  /**
   * Event-based wiring (requires event emitter gadgets)
   * Dependencies: Provider must emit events, consumer must receive
   */
  eventWire: <G extends Gadget = Gadget>(eventName: string = 'propagate'): Action<Match, G> =>
    (match) => {
      if (match.provider.gadget && match.consumer.gadget) {
        const provider = match.provider.gadget as any;
        const consumer = match.consumer.gadget;
        
        if (provider.addEventListener) {
          provider.addEventListener(eventName, (e: Event) => {
            consumer.receive((e as CustomEvent).detail);
          });
        }
      }
    }
};