/**
 * Dynamic Router Meta-Gadget
 *
 * A gadget that manages routing between other gadgets.
 * It interprets routing commands as data and creates/manages actual connections.
 */

import { createGadget, type Gadget } from "../../core";
import { changed, noop } from "../../effects";

// Routing command types
export type RouteCommand =
  | { type: 'connect'; from: string; to: string }
  | { type: 'disconnect'; from: string; to: string }
  | { type: 'send'; from: string; to: string | string[]; data: any }
  | { type: 'broadcast'; from: string; data: any };

// Route table: source ID -> set of target IDs
export type RouteTable = Map<string, Set<string>>;

// Registry to store actual gadget references
export type GadgetRegistry = Map<string, Gadget>;

// Router state includes both the route table and gadget registry
export interface RouterState {
  routes: RouteTable;
  gadgets: GadgetRegistry;
}

/**
 * Creates a dynamic router that manages connections between gadgets
 */
export const router = createGadget<RouterState, RouteCommand>(
  (state, cmd) => {
    switch (cmd.type) {
      case 'connect': {
        // Check if we already have this connection
        const targets = state.routes.get(cmd.from);
        if (targets?.has(cmd.to)) {
          return null; // Already connected
        }
        return { action: 'add_route', context: cmd };
      }

      case 'disconnect': {
        const targets = state.routes.get(cmd.from);
        if (!targets?.has(cmd.to)) {
          return null; // Not connected
        }
        return { action: 'remove_route', context: cmd };
      }

      case 'send': {
        const targets = state.routes.get(cmd.from);
        if (!targets || targets.size === 0) {
          return null; // No routes
        }
        const toList = Array.isArray(cmd.to) ? cmd.to : [cmd.to];
        const validTargets = toList.filter(t => targets.has(t));
        if (validTargets.length === 0) {
          return null; // No valid targets
        }
        return { action: 'forward', context: { ...cmd, targets: validTargets } };
      }

      case 'broadcast': {
        const targets = state.routes.get(cmd.from);
        if (!targets || targets.size === 0) {
          return null; // No routes
        }
        return { action: 'forward', context: { ...cmd, targets: Array.from(targets) } };
      }

      default:
        return null;
    }
  },
  {
    'add_route': (gadget, context) => {
      const state = gadget.current();
      const newRoutes = new Map(state.routes);

      // Add the connection
      const targets = newRoutes.get(context.from) || new Set();
      targets.add(context.to);
      newRoutes.set(context.from, targets);

      gadget.update({ ...state, routes: newRoutes });
      return changed({
        connected: { from: context.from, to: context.to }
      });
    },

    'remove_route': (gadget, context) => {
      const state = gadget.current();
      const newRoutes = new Map(state.routes);

      // Remove the connection
      const targets = newRoutes.get(context.from);
      if (targets) {
        targets.delete(context.to);
        if (targets.size === 0) {
          newRoutes.delete(context.from);
        }
      }

      gadget.update({ ...state, routes: newRoutes });
      return changed({
        disconnected: { from: context.from, to: context.to }
      });
    },

    'forward': (gadget, context) => {
      const state = gadget.current();
      const forwarded: string[] = [];

      // Send data to each target gadget
      for (const targetId of context.targets) {
        const targetGadget = state.gadgets.get(targetId);
        if (targetGadget) {
          targetGadget.receive(context.data);
          forwarded.push(targetId);
        }
      }

      if (forwarded.length > 0) {
        return changed({
          forwarded: {
            from: context.from,
            to: forwarded,
            data: context.data
          }
        });
      }
      return noop();
    }
  }
);

/**
 * Helper function to create a router with initial state
 */
export function createRouter(): Gadget<RouterState, RouteCommand> {
  return router({
    routes: new Map(),
    gadgets: new Map()
  });
}