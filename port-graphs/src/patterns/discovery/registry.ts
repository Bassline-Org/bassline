import { createGadget } from "../../core";
import { changed } from "../../effects";
import _ from "lodash";

/**
 * Registry gadget - Maps names to endpoints/references
 *
 * This is a firstMap-style gadget where first registration wins.
 * Accumulates a directory of name -> endpoint mappings.
 */

export interface Registration {
  name: string;
  endpoint: any; // Could be gadget reference, URL, etc.
  metadata?: Record<string, any>;
}

export interface Query {
  lookup: string;
}

export interface Deregistration {
  remove: string;
}

type RegistryMessage = Registration | Query | Deregistration;
type RegistryState = Record<string, Registration>;

export const registry = createGadget<RegistryState, RegistryMessage>(
  (current, incoming) => {
    if ('name' in incoming && 'endpoint' in incoming) {
      // Registration
      if (current[incoming.name]) {
        return null; // Already registered (first wins)
      }
      return {
        action: 'register',
        context: { registration: incoming }
      };
    }

    if ('lookup' in incoming) {
      // Query
      const found = current[incoming.lookup];
      return {
        action: 'query',
        context: { name: incoming.lookup, found }
      };
    }

    if ('remove' in incoming) {
      // Deregistration
      if (!current[incoming.remove]) {
        return null; // Not registered
      }
      return {
        action: 'deregister',
        context: { name: incoming.remove }
      };
    }

    return null;
  },
  {
    'register': (gadget, { registration }) => {
      const state = { ...gadget.current(), [registration.name]: registration };
      gadget.update(state);
      return changed({ registered: registration });
    },

    'query': (_gadget, { name, found }) => {
      if (found) {
        return changed({ found: { name, ...found } });
      }
      return changed({ notFound: name });
    },

    'deregister': (gadget, { name }) => {
      const state = { ...gadget.current() };
      const removed = state[name];
      delete state[name];
      gadget.update(state);
      return changed({ deregistered: removed });
    }
  }
);

/**
 * Service announcement gadget - Periodically announces presence
 */
export const announcer = createGadget<
  { registration: Registration; interval?: number, timer?: NodeJS.Timeout },
  { start: true } | { stop: true }
>(
  (_current, incoming) => {
    if ('start' in incoming) {
      return { action: 'start' };
    }
    if ('stop' in incoming) {
      return { action: 'stop' };
    }
    return null;
  },
  {
    'start': (gadget) => {
      const { registration, interval = 5000 } = gadget.current();

      // Emit registration immediately
      gadget.emit(changed({ announce: registration }));

      // Set up periodic announcement
      const timer = setInterval(() => {
        gadget.emit(changed({ announce: registration }));
      }, interval);

      // Store timer ID for cleanup
      gadget.update({ ...gadget.current(), timer });

      return changed({ started: registration.name });
    },

    'stop': (gadget) => {
      const { timer, registration } = gadget.current();
      if (timer) {
        clearInterval(timer);
      }
      return changed({ stopped: registration.name });
    }
  }
);