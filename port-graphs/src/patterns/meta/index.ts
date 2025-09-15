/**
 * Meta-Gadgets
 *
 * These demonstrate that meta-level operations follow the same protocol as regular gadgets.
 * The network builds itself using the same mechanism it uses to process data!
 */

// Keep the old implementations for backward compatibility
export * from './router';
export * from './pubsub';

// Export the new clean routing system
export * from './routing';

/**
 * Example of using the new routing system:
 *
 * ```typescript
 * import { createRoutingSystem, firstMap } from './patterns/meta';
 * import { maxCell } from './patterns/cells/numeric';
 *
 * // Create the routing infrastructure
 * const { registry, routes, router } = createRoutingSystem();
 *
 * // Create some gadgets
 * const sensor1 = maxCell(0);
 * const sensor2 = maxCell(0);
 * const display = maxCell(0);
 *
 * // Register them (registry is just a firstMap!)
 * registry.receive({ sensor1, sensor2, display });
 *
 * // Create connections (routes is a cell that handles connect/disconnect)
 * routes.receive({ type: 'connect', from: 'sensor1', to: 'display' });
 * routes.receive({ type: 'connect', from: 'sensor2', to: 'display' });
 *
 * // Send messages (router is a function gadget!)
 * router.receive({ route: { type: 'send', from: 'sensor1', to: 'display', data: 42 } });
 * // display receives 42!
 *
 * // The beauty: registry, routes, and router are all just regular gadgets
 * // following the same consider → act protocol!
 * ```
 */