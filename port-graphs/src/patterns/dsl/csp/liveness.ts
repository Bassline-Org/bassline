/**
 * Liveness for CSP Networks
 *
 * Provides tools for live interaction with CSP networks:
 * - Forward: CSP commands → Network (already exists in handlers)
 * - Reverse: Network state → CSP description (via introspection)
 * - Sync: Manually sync network changes → CSP
 *
 * Note: Automatic bidirectional sync creates infinite loops because:
 * CSP command → Network effect → Reverse compile → CSP command → ...
 *
 * Instead, we provide manual sync for when you modify network directly.
 */

import { createCSPGadget } from './csp';
import type { CSPInput } from './csp';
import { networkEffectsToCSPCommands, extractCSPState } from './csp-reverse';

/**
 * Create a live CSP system with tools for bidirectional interaction
 *
 * The returned CSP gadget has helper methods for live editing:
 * - extractState(): Get current network state as CSP description
 * - syncFromNetwork(): Manually sync network changes back to CSP
 *
 * Forward direction (CSP → Network) works automatically via handlers.
 * Reverse direction (Network → CSP) is manual to avoid infinite loops.
 *
 * @returns CSP gadget with liveness helpers
 */
export function createLiveCSP() {
  const csp = createCSPGadget();
  const network = csp.current().network;

  // Return CSP with helper methods
  return Object.assign(csp, {
    /**
     * Extract current network state as structured data
     */
    extractState: () => extractCSPState(network.current()),

    /**
     * Manually sync network effects back to CSP
     *
     * Use this when you modify the network directly (not via CSP commands)
     * and want to reflect those changes in CSP's view.
     *
     * @param effects - Network effects to reverse compile
     */
    syncFromNetwork: (effects: Partial<Parameters<typeof networkEffectsToCSPCommands>[0]>) => {
      const commands = networkEffectsToCSPCommands(effects, network.current());
      commands.forEach(cmd => csp.receive(cmd));
    },

    /**
     * Get direct access to underlying network
     */
    network
  });
}

/**
 * Type for live CSP with extra methods
 */
export type LiveCSP = ReturnType<typeof createLiveCSP>;
