/**
 * Routing infrastructure using existing gadget patterns
 *
 * This demonstrates that meta-gadgets don't need special infrastructure -
 * they can be built from the patterns we already have!
 */

import _ from "lodash";
import { createGadget, type Gadget } from "../../core";
import { changed } from "../../effects";
import { firstMap } from "../cells/maps";
import { createFn } from "../functions/numeric";

// Route command types
export type RouteCommand =
  | { type: 'connect'; from: string; to: string }
  | { type: 'disconnect'; from: string; to: string }
  | { type: 'send'; from: string; to: string | string[]; data: any }
  | { type: 'broadcast'; from: string; data: any };

// Route table type: from -> array of to
export type RouteTable = Record<string, string[]>;

// Registry is just a firstMap that accumulates gadget references
export type Registry = Record<string, Gadget>;

/**
 * RouteTable cell - manages connections between nodes
 * Handles connect/disconnect commands
 */
export const routeTable = createGadget<RouteTable, RouteCommand>(
  (routes, cmd) => {
    switch (cmd.type) {
      case 'connect': {
        const targets = routes[cmd.from];
        if (targets?.includes(cmd.to)) {
          return null; // Already connected
        }
        return { action: 'add_route', context: cmd };
      }

      case 'disconnect': {
        const targets = routes[cmd.from];
        if (!targets?.includes(cmd.to)) {
          return null; // Not connected
        }
        return { action: 'remove_route', context: cmd };
      }

      default:
        return null; // Ignore send/broadcast - those go to router
    }
  },
  {
    'add_route': (gadget, { from, to }) => {
      const routes = { ...gadget.current() };
      const targets = routes[from] || [];
      routes[from] = [...targets, to];
      gadget.update(routes);
      return changed(routes);
    },

    'remove_route': (gadget, { from, to }) => {
      const routes = { ...gadget.current() };
      const targets = routes[from];
      if (targets) {
        routes[from] = targets.filter(t => t !== to);
        if (routes[from].length === 0) {
          delete routes[from];
        }
      }
      gadget.update(routes);
      return changed(routes);
    }
  }
);

/**
 * Router function gadget - delivers messages using routes and registry
 *
 * Takes 3 arguments:
 * - routes: The current route table
 * - gadgets: The registry of gadgets
 * - route: The routing command to execute
 */
export const createRouter = () => {
  return createFn<
    {
      routes: RouteTable;
      gadgets: Registry;
      route: RouteCommand;
    },
    { delivered: string[] } | null
  >(
    ({ routes, gadgets, route }) => {
      // Only handle send/broadcast commands
      if (!route || (route.type !== 'send' && route.type !== 'broadcast')) {
        return null;
      }

      const delivered: string[] = [];

      if (route.type === 'send') {
        const targets = _.castArray(route.to);
        const routeTargets = _.castArray(routes[route.from]);

        for (const target of targets) {
          if (routeTargets.includes(target)) {
            const gadget = gadgets[target];
            if (gadget) {
              gadget.receive(route.data);
              delivered.push(target);
            }
          }
        }
      } else if (route.type === 'broadcast') {
        const routeTargets = _.castArray(routes[route.from]);

        for (const target of routeTargets) {
          const gadget = gadgets[target];
          if (gadget) {
            gadget.receive(route.data);
            delivered.push(target);
          }
        }
      }

      return delivered.length > 0 ? { delivered } : null;
    },
    ['routes', 'gadgets', 'route']
  );
};

/**
 * Helper to create a complete routing system
 * Returns registry, routeTable, and router all wired together
 */
export function createRoutingSystem() {
  // Create the components
  const registry = firstMap({} as Registry);
  const routes = routeTable({});
  const router = createRouter()({
    routes: {},
    gadgets: {},
    route: null as any // Start with null route
  });

  // Wire them together
  // When registry changes, update router's gadgets argument
  const origRegistryEmit = registry.emit;
  registry.emit = (effect) => {
    origRegistryEmit(effect);
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      router.receive({ gadgets: effect.changed as Registry });
    }
  };

  // When routes change, update router's routes argument
  const origRoutesEmit = routes.emit;
  routes.emit = (effect) => {
    origRoutesEmit(effect);
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      router.receive({ routes: effect.changed as RouteTable });
    }
  };

  return { registry, routes, router };
}