import { createGadget, Gadget } from "../../core";
import { changed } from "../../effects";
import _ from "lodash";

/**
 * Role definitions for choreographies
 *
 * A role describes a participant in a choreography with:
 * - name: Unique identifier for the role
 * - type: What kind of participant (coordinator, worker, etc.)
 * - capabilities: What the role can do
 * - cardinality: How many instances (1, n, etc.)
 */

export interface Role {
  name: string;
  type: string;
  capabilities?: string[];
  cardinality?: number | 'many';
  metadata?: Record<string, any>;
}

export interface Relationship {
  from: string;  // Role name
  to: string;    // Role name
  type: string;  // Type of relationship (sends, receives, coordinates, etc.)
  protocol?: string; // Protocol name if specific
}

/**
 * Role accumulator gadget
 *
 * Accumulates role definitions until a complete choreography can be formed
 */
export const roleAccumulator = createGadget<
  { roles: Record<string, Role>; relationships: Relationship[] },
  { role: Role } | { relationship: Relationship } | { check: true }
>(
  (current, incoming) => {
    if ('role' in incoming) {
      // New role definition
      if (current.roles[incoming.role.name]) {
        return null; // Already have this role
      }
      return {
        action: 'addRole',
        context: { role: incoming.role }
      };
    }

    if ('relationship' in incoming) {
      // New relationship definition
      const exists = current.relationships.some(r =>
        r.from === incoming.relationship.from &&
        r.to === incoming.relationship.to &&
        r.type === incoming.relationship.type
      );
      if (exists) {
        return null; // Already have this relationship
      }
      return {
        action: 'addRelationship',
        context: { relationship: incoming.relationship }
      };
    }

    if ('check' in incoming) {
      // Check if we can instantiate
      return {
        action: 'checkCompleteness'
      };
    }

    return null;
  },
  {
    'addRole': (gadget, { role }) => {
      const state = gadget.current();
      state.roles[role.name] = role;
      gadget.update(state);
      return changed({ roleAdded: role });
    },

    'addRelationship': (gadget, { relationship }) => {
      const state = gadget.current();
      state.relationships.push(relationship);
      gadget.update(state);
      return changed({ relationshipAdded: relationship });
    },

    'checkCompleteness': (gadget) => {
      const { roles, relationships } = gadget.current();

      // Check if all relationship endpoints have roles
      const missingRoles: string[] = [];
      for (const rel of relationships) {
        if (!roles[rel.from]) missingRoles.push(rel.from);
        if (!roles[rel.to]) missingRoles.push(rel.to);
      }

      if (missingRoles.length > 0) {
        return changed({
          incomplete: {
            reason: 'missing-roles',
            missing: _.uniq(missingRoles)
          }
        });
      }

      // Check if we have enough to instantiate
      const roleCount = Object.keys(roles).length;
      if (roleCount < 2) {
        return changed({
          incomplete: {
            reason: 'insufficient-roles',
            current: roleCount,
            minimum: 2
          }
        });
      }

      return changed({
        complete: {
          roles: Object.values(roles),
          relationships
        }
      });
    }
  }
);

/**
 * Creates a specific choreography pattern
 */
export function createChoreography(pattern: {
  name: string;
  roles: Role[];
  relationships: Relationship[];
  minInstances?: Record<string, number>;
}) {
  const accumulator = roleAccumulator({ roles: {}, relationships: [] });

  // Pre-populate with pattern definition
  pattern.roles.forEach(role => {
    accumulator.receive({ role });
  });

  pattern.relationships.forEach(relationship => {
    accumulator.receive({ relationship });
  });

  return {
    accumulator,
    pattern
  };
}