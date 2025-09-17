import { createGadget, Gadget } from "../../core";
import { changed, noop } from "../../effects";
import { Role, Relationship, roleAccumulator } from "./roles";
import { validateChoreography, validateRoleAddition } from "./validation";
import { wireParticipants } from "./wiring";
import _ from "lodash";

/**
 * Dynamic choreography construction
 *
 * Builds choreographies from partial information and allows runtime modification
 */

export interface PartialChoreography {
  roles: Record<string, Role>;
  relationships: Relationship[];
  factories?: Record<string, () => Gadget>;
  ready: boolean;
}

/**
 * Partial choreography builder
 *
 * Accumulates roles and relationships until ready to instantiate
 */
export const partialChoreography = createGadget<
  PartialChoreography,
  | { role: Role }
  | { relationship: Relationship }
  | { factory: { type: string; factory: () => Gadget } }
  | { checkReady: true }
  | { instantiate: true }
>(
  (current, incoming) => {
    if ('role' in incoming) {
      if (current.roles[incoming.role.name]) {
        return null; // Already have this role
      }
      return { action: 'addRole', context: { role: incoming.role } };
    }

    if ('relationship' in incoming) {
      const exists = current.relationships.some(r =>
        r.from === incoming.relationship.from &&
        r.to === incoming.relationship.to &&
        r.type === incoming.relationship.type
      );
      if (exists) return null;
      return { action: 'addRelationship', context: { rel: incoming.relationship } };
    }

    if ('factory' in incoming) {
      return { action: 'addFactory', context: incoming.factory };
    }

    if ('checkReady' in incoming) {
      return { action: 'checkReadiness' };
    }

    if ('instantiate' in incoming) {
      if (!current.ready) return null;
      return { action: 'instantiate' };
    }

    return null;
  },
  {
    'addRole': (gadget, { role }) => {
      const state = gadget.current();
      state.roles[role.name] = role;
      gadget.update(state);

      // Check if we're ready after adding
      gadget.receive({ checkReady: true });

      return changed({ roleAdded: role });
    },

    'addRelationship': (gadget, { rel }) => {
      const state = gadget.current();
      state.relationships.push(rel);
      gadget.update(state);

      // Check if we're ready after adding
      gadget.receive({ checkReady: true });

      return changed({ relationshipAdded: rel });
    },

    'addFactory': (gadget, { type, factory }) => {
      const state = gadget.current();
      if (!state.factories) state.factories = {};
      state.factories[type] = factory;
      gadget.update(state);
      return changed({ factoryAdded: type });
    },

    'checkReadiness': (gadget) => {
      const state = gadget.current();
      const roles = Object.values(state.roles);

      // Need at least 2 roles
      if (roles.length < 2) {
        return changed({ notReady: 'insufficient-roles' });
      }

      // Validate the partial choreography
      const validation = validateChoreography(roles, state.relationships);

      if (validation.valid) {
        state.ready = true;
        gadget.update(state);
        return changed({ ready: true, validation });
      } else {
        state.ready = false;
        gadget.update(state);
        return changed({ notReady: validation.errors });
      }
    },

    'instantiate': (gadget) => {
      const state = gadget.current();
      const participants: Record<string, Gadget> = {};

      // Create participants
      for (const role of Object.values(state.roles)) {
        const factory = state.factories?.[role.type];
        if (factory) {
          participants[role.name] = factory();
        } else {
          // Default passthrough gadget
          participants[role.name] = createGadget(
            (_s, data) => ({ action: 'pass', context: { data } }),
            { 'pass': (_g, { data }) => changed(data) }
          )({});
        }
      }

      // Wire them
      const wired = wireParticipants(participants, state.relationships);

      return changed({
        instantiated: {
          participants: Object.keys(participants),
          wired
        }
      });
    }
  }
);

/**
 * Runtime choreography modifier
 *
 * Allows adding/removing participants from running choreography
 */
export interface RuntimeChoreography {
  participants: Record<string, Gadget>;
  roles: Record<string, Role>;
  relationships: Relationship[];
  active: boolean;
}

export const runtimeChoreography = createGadget<
  RuntimeChoreography,
  | { addParticipant: { role: Role; gadget?: Gadget } }
  | { removeParticipant: string }
  | { replaceParticipant: { role: string; newGadget: Gadget } }
  | { addRelationship: Relationship }
>(
  (current, incoming) => {
    if ('addParticipant' in incoming && current.active) {
      return { action: 'add', context: incoming.addParticipant };
    }

    if ('removeParticipant' in incoming && current.active) {
      return { action: 'remove', context: { role: incoming.removeParticipant } };
    }

    if ('replaceParticipant' in incoming && current.active) {
      return { action: 'replace', context: incoming.replaceParticipant };
    }

    if ('addRelationship' in incoming && current.active) {
      return { action: 'wire', context: { rel: incoming.addRelationship } };
    }

    return null;
  },
  {
    'add': (gadget, { role, gadget: newGadget }) => {
      const state = gadget.current();

      // Validate addition
      const validation = validateRoleAddition(
        Object.values(state.roles),
        role,
        []
      );

      if (!validation.valid) {
        return changed({ addFailed: validation.errors });
      }

      // Create gadget if not provided
      const participant = newGadget || createGadget(
        (_s, data) => ({ action: 'pass', context: { data } }),
        { 'pass': (_g, { data }) => changed(data) }
      )({});

      // Add to state
      state.participants[role.name] = participant;
      state.roles[role.name] = role;
      gadget.update(state);

      return changed({
        participantAdded: {
          role: role.name,
          active: true
        }
      });
    },

    'remove': (gadget, { role }) => {
      const state = gadget.current();

      if (!state.participants[role]) {
        return changed({ removeFailed: `Role ${role} not found` });
      }

      // Disconnect the participant (would need to unwire here)
      delete state.participants[role];
      delete state.roles[role];

      // Remove relationships involving this role
      state.relationships = state.relationships.filter(
        rel => rel.from !== role && rel.to !== role
      );

      gadget.update(state);

      return changed({ participantRemoved: role });
    },

    'replace': (gadget, { role, newGadget }) => {
      const state = gadget.current();

      if (!state.participants[role]) {
        return changed({ replaceFailed: `Role ${role} not found` });
      }

      // Keep the role, replace the gadget
      state.participants[role] = newGadget;
      gadget.update(state);

      // Re-wire relationships
      const relevantRels = state.relationships.filter(
        rel => rel.from === role || rel.to === role
      );
      wireParticipants(state.participants, relevantRels);

      return changed({ participantReplaced: role });
    },

    'wire': (gadget, { rel }) => {
      const state = gadget.current();

      // Add relationship
      state.relationships.push(rel);

      // Wire it
      wireParticipants(state.participants, [rel]);

      gadget.update(state);

      return changed({ relationshipAdded: rel });
    }
  }
);

/**
 * Create a self-assembling choreography
 */
export function createSelfAssemblingChoreography(minRoles = 2) {
  const partial = partialChoreography({
    roles: {},
    relationships: [],
    ready: false
  });

  // Monitor for readiness
  partial.emit = (effect) => {
    if (effect?.changed?.ready === true) {
      // Auto-instantiate when ready
      partial.receive({ instantiate: true });
    }
  };

  return partial;
}