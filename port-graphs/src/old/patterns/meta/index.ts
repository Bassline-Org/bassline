/**
 * Meta-Patterns
 *
 * Simple utilities for coordinating gadgets.
 * These are much simpler than full meta-gadgets - just helpers.
 */

export * from './pubsub';
export * from './topics';

/**
 * Example of using topics:
 *
 * ```typescript
 * import { createTopics } from './patterns/meta';
 * import { eventSemantics } from './semantics';
 * import { maxCell } from './patterns/cells';
 *
 * // Create topic router
 * const topics = createTopics();
 *
 * // Create gadgets with event semantics
 * const sensor = eventSemantics(maxCell(0));
 * const display = eventSemantics(maxCell(0));
 *
 * // Subscribe display to temperature topic
 * topics.subscribe('temperature', display);
 *
 * // When sensor changes, publish to topic
 * sensor.on('changed', (e) => {
 *   topics.publish('temperature', e.detail);
 * });
 *
 * // Or wire directly without topics
 * sensor.on('changed', (e) => {
 *   display.receive(e.detail);
 * });
 * ```
 */