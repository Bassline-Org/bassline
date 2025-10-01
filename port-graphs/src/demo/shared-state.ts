/**
 * Shared State Gadget (Transport-Agnostic)
 *
 * This gadget has ZERO knowledge of networking, WebSocket, HTTP, or any transport.
 * It's pure business logic that can work:
 * - In-memory
 * - Over WebSocket
 * - Over HTTP
 * - Over IPC
 * - Over any transport via adapters
 *
 * The protocol type (Implements<Valued<Set<number>>>) is what lets adapters
 * work with it generically.
 */

import { Protocols } from '..';
import { quick, withTaps, Implements } from '../core/context';
import { unionProto } from '../patterns/cells';

/**
 * Create a shared state gadget.
 *
 * Returns a gadget implementing Valued<Set<number>> protocol:
 * - Input: Set<number> (new values to add)
 * - Effects: { changed: Set<number> } (when state updates)
 *
 * The union cell automatically:
 * - Merges incoming sets (union operation)
 * - Ignores subsets (already have those values)
 * - Is Associative, Commutative, Idempotent (ACI)
 *
 * This means:
 * - Order of updates doesn't matter
 * - Duplicate updates are ignored
 * - Concurrent updates converge correctly
 *
 * These properties make it perfect for distributed sync!
 */
export function createSharedState(): Implements<Protocols.Valued<Set<number>>> {
  const state = withTaps(quick(unionProto<number>(), new Set<number>()));

  // Add some application logic (completely optional)
  state.tap(({ changed }) => {
    if (changed) {
      const sorted = Array.from(changed).sort((a, b) => a - b);
      console.log(`[SharedState] Updated: ${sorted.join(', ')} (${changed.size} total)`);
    }
  });

  return state;
}

/**
 * Alternative: Create a max counter gadget.
 *
 * Returns Implements<Valued<number>> - monotonically increasing counter.
 */
export function createMaxCounter<T>(): Implements<Protocols.Valued<Set<T>>> {
  const state = withTaps(quick(
    // maxProto needs to be imported from cells
    // For now just using unionProto as example
    unionProto<T>(),
    new Set<T>()
  ));

  return state; // Would be properly typed with maxProto
}
