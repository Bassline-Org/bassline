/**
 * Constraint-Based Liveness for CSP
 *
 * Wires CSP, Network, and Description as a constraint network where
 * changes propagate bidirectionally through idempotent relations.
 *
 * Three gadgets hold partial information:
 * - CSP: Commands and semantic structure
 * - Network: Executable gadget instances and live state
 * - Description: Serialized JSON representation
 *
 * Constraints keep them synchronized:
 * - Network state ↔ Description (serialize/deserialize)
 * - Description edits → CSP commands (patch generation)
 * - CSP effects → Description updates (via network)
 *
 * All constraints are idempotent, so bidirectional loops converge.
 */

import { createCSPGadget } from './csp';
import { serialize } from './serialize';
import { emptyCSPDescription, type CSPDescription } from './schema';
import { withTaps, quick } from '../../../core/context';
import { lastProto } from '../../cells';
import { relate, forward } from '../../relations/relate';
import type { Implements } from '../../../core/context';
import type { Valued } from '../../../core/protocols';

/**
 * Create a CSP system with constraint-based liveness
 *
 * Returns three synchronized gadgets:
 * - csp: Command interface (standard CSP gadget)
 * - network: Underlying network (for direct access)
 * - description: JSON description (editable representation)
 *
 * Changes to any gadget propagate to the others:
 * - Edit description → CSP + network update
 * - Send CSP commands → Description + network update
 * - Network propagates → Description updates
 *
 * @returns Object with csp, network, and description gadgets, plus cleanup
 *
 * @example
 * ```typescript
 * const live = createConstraintLiveCSP();
 *
 * // Edit description
 * const newDesc = { ...live.description.current() };
 * newDesc.variables.v1 = { type: 'color', domain: { __type: 'Set', values: ['R'] }};
 * live.description.receive(newDesc);
 * // → CSP and network automatically update
 *
 * // Send CSP command
 * live.csp.receive({ create: { id: 'v2', type: 'color' }});
 * // → Description automatically updates
 *
 * // Network propagates
 * const instances = live.network.current().spawning.current().instances.current();
 * instances.get('v1')?.receive(new Set(['G']));
 * // → Description reflects new domain
 * ```
 */
export function createConstraintLiveCSP() {
  // Create CSP gadget
  const csp = createCSPGadget();
  const network = csp.current().network;

  // Create description gadget (Valued<CSPDescription>)
  const description = withTaps(
    quick(lastProto<CSPDescription>(), emptyCSPDescription())
  );

  // Track when we're propagating to prevent infinite loops
  let propagating = false;

  // Constraint: CSP effects → Description
  // When CSP semantic state changes (structure or domains), serialize and update description
  const cleanupCspToDesc = csp.tap(({ introspected }) => {
    // Skip introspection effects (serialize triggers these internally)
    if (introspected || propagating) {
      return;
    }

    propagating = true;
    try {
      const newDesc = serialize(csp);
      description.receive(newDesc);
    } finally {
      propagating = false;
    }
  });

  // Constraint: Description → CSP
  // When description changes, compute diff and send commands to CSP
  const cleanupDescToCsp = description.tap(({ changed }) => {
    if (changed) {
      // For now, just trigger a re-sync by serializing current state
      // In a full implementation, we'd compute a diff and generate minimal commands
      // But since our operations are idempotent, we can just re-send everything
      const currentDesc = changed;

      // Re-apply variables (idempotent)
      Object.entries(currentDesc.variables || {}).forEach(([id, varDef]) => {
        // Check if variable already exists
        const instances = network.current().spawning.current().instances.current();
        if (!instances.has(id)) {
          // Variable doesn't exist, create it
          csp.receive({ create: { id, type: varDef.type } });
        }

        // Update domain if provided
        if (varDef.domain) {
          const instance = instances.get(id);
          if (instance && typeof instance.receive === 'function') {
            // Domain needs to be deserialized from JSON format
            let domainValue = varDef.domain;
            if (
              typeof domainValue === 'object' &&
              domainValue !== null &&
              '__type' in domainValue &&
              domainValue.__type === 'Set'
            ) {
              domainValue = new Set((domainValue as any).values);
            }
            instance.receive(domainValue);
          }
        }
      });
    }
  });

  // Initial sync: serialize network to description
  const initialDesc = serialize(csp);
  description.receive(initialDesc);

  // Return all three gadgets plus cleanup
  return {
    csp,
    network,
    description,
    cleanup: () => {
      cleanupCspToDesc();
      cleanupDescToCsp();
    }
  };
}

/**
 * Type for constraint-based live CSP system
 */
export type ConstraintLiveCSP = ReturnType<typeof createConstraintLiveCSP>;
