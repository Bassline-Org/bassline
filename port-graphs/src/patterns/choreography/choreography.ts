import { createGadget, Gadget } from "../../core";
import { changed, creation } from "../../effects";
import { Role, Relationship } from "./roles";
import { wireParticipants } from "./wiring";
import { ChoreographyError, ChoreographyEffect, createHealthMonitor, createTimeoutMonitor } from "./errors";

/**
 * Choreography gadget - Instantiates and wires participants
 *
 * Receives a complete choreography specification and:
 * 1. Creates participant gadgets for each role
 * 2. Wires them according to relationships
 * 3. Manages the lifecycle of the choreography
 */

export interface ChoreographySpec {
  roles: Role[];
  relationships: Relationship[];
  factories?: Record<string, () => Gadget>; // Role type → gadget factory
}

export interface ChoreographyState {
  spec?: ChoreographySpec;
  participants: Record<string, Gadget>; // Role name → gadget instance
  wired: boolean;
  active: boolean;
}

export const choreography = createGadget<
  ChoreographyState,
  { instantiate: ChoreographySpec } | { start: true } | { stop: true }
>(
  (current, incoming) => {
    if ('instantiate' in incoming) {
      if (current.active) {
        return null; // Already have an active choreography
      }
      return {
        action: 'instantiate',
        context: { spec: incoming.instantiate }
      };
    }

    if ('start' in incoming) {
      if (!current.spec || current.active) {
        return null; // Nothing to start or already active
      }
      return { action: 'start' };
    }

    if ('stop' in incoming) {
      if (!current.active) {
        return null; // Not active
      }
      return { action: 'stop' };
    }

    return null;
  },
  {
    'instantiate': (gadget, { spec }) => {
      const participants: Record<string, Gadget> = {};

      // Create participant gadgets for each role
      for (const role of spec.roles) {
        const factory = spec.factories?.[role.type];
        if (factory) {
          participants[role.name] = factory();
        } else {
          // Default: create a simple passthrough gadget
          participants[role.name] = createGadget(
            (_state, data) => ({ action: 'forward', context: { data } }),
            { 'forward': (_g, { data }) => changed({ [role.name]: data }) }
          )({});
        }
      }

      // Wire participants using improved wiring logic
      const wired = wireParticipants(participants, spec.relationships);

      gadget.update({
        spec,
        participants,
        wired: true,
        active: false
      });

      return changed({
        instantiated: {
          roleCount: spec.roles.length,
          relationshipCount: spec.relationships.length,
          participants: Object.keys(participants)
        }
      });
    },

    'start': (gadget) => {
      const state = gadget.current();
      state.active = true;
      gadget.update(state);

      // Emit creation effects for all participants
      Object.values(state.participants).forEach(p => {
        gadget.emit(creation(p));
      });

      return changed({ started: Object.keys(state.participants) });
    },

    'stop': (gadget) => {
      const state = gadget.current();
      state.active = false;
      gadget.update(state);

      return changed({ stopped: Object.keys(state.participants) });
    }
  }
);

/**
 * Two-Phase Commit choreography pattern
 */
export function twoPhaseCommit() {
  return {
    instantiate: {
      roles: [
        { name: 'coordinator', type: 'coordinator', capabilities: ['coordinate', 'decide'] },
        { name: 'participant1', type: 'participant', capabilities: ['vote', 'commit', 'abort'] },
        { name: 'participant2', type: 'participant', capabilities: ['vote', 'commit', 'abort'] }
      ],
      relationships: [
        { from: 'coordinator', to: 'participant1', type: 'sends', protocol: 'prepare' },
        { from: 'coordinator', to: 'participant2', type: 'sends', protocol: 'prepare' },
        { from: 'participant1', to: 'coordinator', type: 'responds', protocol: 'vote' },
        { from: 'participant2', to: 'coordinator', type: 'responds', protocol: 'vote' },
        { from: 'coordinator', to: 'participant1', type: 'sends', protocol: 'decision' },
        { from: 'coordinator', to: 'participant2', type: 'sends', protocol: 'decision' }
      ]
    }
  };
}

/**
 * Pub/Sub choreography pattern
 */
export function pubSubPattern(publisherCount = 1, subscriberCount = 3) {
  const roles: Role[] = [
    { name: 'broker', type: 'broker', capabilities: ['route', 'filter'] }
  ];

  const relationships: Relationship[] = [];

  // Add publishers
  for (let i = 0; i < publisherCount; i++) {
    const pubName = `publisher${i}`;
    roles.push({ name: pubName, type: 'publisher' });
    relationships.push({ from: pubName, to: 'broker', type: 'sends' });
  }

  // Add subscribers
  for (let i = 0; i < subscriberCount; i++) {
    const subName = `subscriber${i}`;
    roles.push({ name: subName, type: 'subscriber' });
    relationships.push({ from: 'broker', to: subName, type: 'sends' });
  }

  return { instantiate: { roles, relationships } };
}