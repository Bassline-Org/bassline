/**
 * Meta-Gadgets
 *
 * These demonstrate that meta-level operations follow the same protocol as regular gadgets.
 * The network builds itself using the same mechanism it uses to process data!
 */

// Export the pubsub system
export * from './routing';

/**
 * Example of using the pubsub system:
 *
 * ```typescript
 * import { createPubSubSystem } from './patterns/meta';
 * import { maxCell } from './patterns/cells/numeric';
 *
 * // Create the pubsub infrastructure
 * const { registry, subscriptions, pubsub } = createPubSubSystem();
 *
 * // Create some gadgets
 * const sensor1 = maxCell(0);
 * const sensor2 = maxCell(0);
 * const display = maxCell(0);
 *
 * // Register them (registry is just a firstMap!)
 * registry.receive({ sensor1, sensor2, display });
 *
 * // Subscribe to topics (subscriptions is a cell!)
 * subscriptions.receive({ type: 'subscribe', topic: 'temperature', subscriber: 'display' });
 * subscriptions.receive({ type: 'subscribe', topic: 'humidity', subscriber: 'display' });
 *
 * // Publish messages (pubsub is a function gadget!)
 * pubsub.receive({ command: { type: 'publish', topic: 'temperature', data: 72 } });
 * // display receives 72!
 *
 * // The beauty: registry, subscriptions, and pubsub are all just regular gadgets
 * // following the same consider → act protocol!
 * ```
 */