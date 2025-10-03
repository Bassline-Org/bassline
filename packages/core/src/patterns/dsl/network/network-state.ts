/**
 * Network State as Valued Gadget
 *
 * Wraps a network gadget to expose its state as a Valued gadget.
 * This allows network state to participate in bidirectional constraints.
 */

import { withTaps, quick } from '../../../core/context';
import { lastProto } from '../../cells';
import type { Implements } from '../../../core/context';
import type { Valued } from '../../../core/protocols';
import type { NetworkState } from './network';

/**
 * Extract network state as a plain object
 */
export function extractNetworkState(networkState: NetworkState): {
  definitions: Map<string, unknown>;
  instances: Map<string, unknown>;
  instanceTypes: Map<string, string>;
} {
  return {
    definitions: new Map(networkState.definitions.current()),
    instances: new Map(networkState.spawning.current().instances.current()),
    instanceTypes: new Map(networkState.instanceTypes.current())
  };
}

/**
 * Create a Valued gadget that reflects network state
 *
 * The gadget emits { changed: state } whenever the network changes.
 * You can also send state to it, though typically network state is
 * derived from network effects rather than set directly.
 *
 * @param network - Network gadget to observe
 * @returns Valued gadget holding network state
 *
 * @example
 * ```typescript
 * const network = createNetworkGadget();
 * const state = networkStateGadget(network);
 *
 * // Observe network changes
 * state.tap(({ changed }) => {
 *   console.log('Network state:', changed);
 * });
 *
 * // Network changes propagate to state gadget
 * network.receive({ spawn: { id: 'v1', type: 'number' }});
 * // state emits { changed: { instances: Map(['v1', ...]), ... }}
 * ```
 */
export function networkStateGadget(
  network: Implements<Valued<NetworkState>>
): Implements<Valued<ReturnType<typeof extractNetworkState>>> {
  // Create cell to hold state
  const initial = extractNetworkState(network.current());
  const stateCell = withTaps(quick(lastProto(), initial));

  // Observe network changes
  network.tap(() => {
    const newState = extractNetworkState(network.current());
    stateCell.receive(newState);
  });

  return stateCell;
}
