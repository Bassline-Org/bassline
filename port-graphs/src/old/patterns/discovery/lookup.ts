import { createGadget, Gadget } from "../../core";
import { changed } from "../../effects";
import { Registration } from "./registry";

/**
 * Lookup gadget - Resolves names to endpoints through a registry
 *
 * Caches lookups and can wire gadgets automatically when resolved.
 */

export interface LookupRequest {
  resolve: string;
  cache?: boolean; // Cache the result (default: true)
}

export interface LookupState {
  cache: Record<string, Registration>;
  pending: Record<string, boolean>;
}

export const lookup = createGadget<LookupState, LookupRequest | { found: any } | { notFound: string }>(
  (current, incoming) => {
    if ('resolve' in incoming) {
      // Check cache first
      const cached = current.cache[incoming.resolve];
      if (cached) {
        return {
          action: 'cached',
          context: { registration: cached }
        };
      }

      // Mark as pending to avoid duplicate lookups
      if (current.pending[incoming.resolve]) {
        return null; // Already looking up
      }

      return {
        action: 'lookup',
        context: { name: incoming.resolve, cache: incoming.cache ?? true }
      };
    }

    if ('found' in incoming && incoming.found) {
      // Registry responded with a result
      const { name, ...registration } = incoming.found;
      return {
        action: 'resolved',
        context: { name, registration }
      };
    }

    if ('notFound' in incoming) {
      // Registry couldn't find it
      return {
        action: 'failed',
        context: { name: incoming.notFound }
      };
    }

    return null;
  },
  {
    'cached': (_gadget, { registration }) => {
      return changed({ resolved: registration });
    },

    'lookup': (gadget, { name }) => {
      const state = gadget.current();
      state.pending[name] = true;
      gadget.update(state);
      // Emit lookup query - should be wired to registry
      return changed({ lookup: name });
    },

    'resolved': (gadget, { name, registration, cache = true }) => {
      const state = gadget.current();
      delete state.pending[name];
      if (cache) {
        state.cache[name] = registration;
      }
      gadget.update(state);
      return changed({ resolved: registration });
    },

    'failed': (gadget, { name }) => {
      const state = gadget.current();
      delete state.pending[name];
      gadget.update(state);
      return changed({ failed: name });
    }
  }
);

/**
 * Auto-wiring lookup - Automatically wires gadgets when names are resolved
 */
export interface WiringRequest {
  wire: {
    from: string;
    to: string;
    transform?: (effect: any) => any;
  };
}

export const autoWire = createGadget<
  { wired: Record<string, Gadget> },
  WiringRequest | { resolved: Registration }
>(
  (current, incoming) => {
    if ('wire' in incoming) {
      return {
        action: 'request',
        context: incoming.wire
      };
    }

    if ('resolved' in incoming) {
      // A lookup was resolved, check if we can complete any wiring
      return {
        action: 'checkWiring',
        context: { registration: incoming.resolved }
      };
    }

    return null;
  },
  {
    'request': (gadget, request) => {
      // Emit lookup requests for both endpoints
      return changed({
        lookupBatch: [
          { resolve: request.from },
          { resolve: request.to }
        ]
      });
    },

    'checkWiring': (gadget, { registration }) => {
      // Store resolved gadget
      const state = gadget.current();
      if (registration.endpoint && typeof registration.endpoint.receive === 'function') {
        state.wired[registration.name] = registration.endpoint;
        gadget.update(state);
      }
      return changed({ stored: registration.name });
    }
  }
);