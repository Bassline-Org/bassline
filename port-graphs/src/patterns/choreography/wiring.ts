import { Gadget } from "../../core";
import { addEmitTarget, wireEmitToReceive, broadcastEmit } from "../../semantics/compose";
import { Relationship } from "./roles";

/**
 * Advanced wiring logic for choreographies
 *
 * Supports different relationship types and patterns
 */

export type WiringStrategy = (
  from: Gadget,
  to: Gadget | Gadget[],
  relationship: Relationship
) => void;

/**
 * Wire participants based on relationship type
 */
export function wireParticipants(
  participants: Record<string, Gadget>,
  relationships: Relationship[]
) {
  const wired: string[] = [];

  for (const rel of relationships) {
    const from = participants[rel.from];
    const to = participants[rel.to];

    if (!from || !to) {
      console.warn(`Cannot wire ${rel.from} → ${rel.to}: participant not found`);
      continue;
    }

    // Select wiring strategy based on relationship type
    const strategy = selectStrategy(rel.type);
    strategy(from, to, rel);

    wired.push(`${rel.from} → ${rel.to} (${rel.type})`);
  }

  return wired;
}

/**
 * Select appropriate wiring strategy
 */
function selectStrategy(relationType: string): WiringStrategy {
  switch (relationType) {
    case 'sends':
      return wireSends;
    case 'responds':
      return wireResponds;
    case 'broadcasts':
      return wireBroadcasts;
    case 'subscribes':
      return wireSubscribes;
    case 'coordinates':
      return wireCoordinates;
    case 'replicates':
      return wireReplicates;
    default:
      return wireSends; // Default to simple send
  }
}

/**
 * One-way send relationship
 */
function wireSends(from: Gadget, to: Gadget | Gadget[], rel: Relationship) {
  if (Array.isArray(to)) {
    broadcastEmit(from, to);
  } else {
    wireEmitToReceive(from, to, (effect: any) => {
      // Tag with protocol if specified
      if (rel.protocol && effect && typeof effect === 'object') {
        return { ...effect, protocol: rel.protocol };
      }
      return effect;
    });
  }
}

/**
 * Request-response relationship
 */
function wireResponds(from: Gadget, to: Gadget | Gadget[], rel: Relationship) {
  if (Array.isArray(to)) {
    throw new Error('Response relationship must have single target');
  }

  // Wire request
  wireEmitToReceive(from, to, (effect: any) => {
    if (effect && typeof effect === 'object') {
      return { ...effect, replyTo: rel.from, protocol: rel.protocol };
    }
    return effect;
  });

  // Wire response back
  addEmitTarget(to, (effect: any) => {
    if (effect && typeof effect === 'object' && effect.replyTo === rel.from) {
      from.receive(effect);
    }
  });
}

/**
 * Broadcast to all others
 */
function wireBroadcasts(from: Gadget, _to: Gadget | Gadget[], rel: Relationship) {
  // Note: This should broadcast to all participants except sender
  // Would need participant list from context
  addEmitTarget(from, (effect: any) => {
    if (effect && typeof effect === 'object') {
      console.log(`[Broadcast from ${rel.from}]`, effect);
      // In real implementation, would send to all other participants
    }
  });
}

/**
 * Pub/sub relationship
 */
function wireSubscribes(from: Gadget, to: Gadget | Gadget[], rel: Relationship) {
  if (Array.isArray(to)) {
    throw new Error('Subscribe relationship must have single publisher');
  }

  // Subscriber registers interest
  from.receive({ subscribe: { topic: rel.protocol || '*', subscriber: rel.from } });

  // Publisher sends to subscriber
  addEmitTarget(to, (effect: any) => {
    if (effect && typeof effect === 'object') {
      const topic = effect.topic || rel.protocol;
      if (!rel.protocol || topic === rel.protocol) {
        from.receive(effect);
      }
    }
  });
}

/**
 * Coordination relationship (bidirectional with priority)
 */
function wireCoordinates(from: Gadget, to: Gadget | Gadget[], rel: Relationship) {
  if (Array.isArray(to)) {
    // Coordinate multiple participants
    broadcastEmit(from, to);
    to.forEach(participant => {
      wireEmitToReceive(participant, from, (effect: any) => ({
        ...effect,
        from: 'participant'
      }));
    });
  } else {
    // Bidirectional with role tags
    wireEmitToReceive(from, to, (e: any) => ({ ...e, role: 'coordinator' }));
    wireEmitToReceive(to, from, (e: any) => ({ ...e, role: 'participant' }));
  }
}

/**
 * State replication relationship
 */
function wireReplicates(from: Gadget, to: Gadget | Gadget[], rel: Relationship) {
  // Every state change is replicated
  addEmitTarget(from, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      if (Array.isArray(to)) {
        to.forEach(replica => replica.receive(effect.changed));
      } else {
        to.receive(effect.changed);
      }
    }
  });
}

/**
 * Create a wiring builder for fluent API
 */
export class WiringBuilder {
  private relationships: Relationship[] = [];

  from(role: string): this {
    this.currentFrom = role;
    return this;
  }

  to(role: string): this {
    this.currentTo = role;
    return this;
  }

  sends(protocol?: string): this {
    this.addRelationship('sends', protocol);
    return this;
  }

  responds(protocol?: string): this {
    this.addRelationship('responds', protocol);
    return this;
  }

  broadcasts(protocol?: string): this {
    this.addRelationship('broadcasts', protocol);
    return this;
  }

  coordinates(): this {
    this.addRelationship('coordinates');
    return this;
  }

  private currentFrom?: string;
  private currentTo?: string;

  private addRelationship(type: string, protocol?: string) {
    if (!this.currentFrom || !this.currentTo) {
      throw new Error('Must specify from and to before relationship type');
    }

    this.relationships.push({
      from: this.currentFrom,
      to: this.currentTo,
      type,
      protocol
    });
  }

  build(): Relationship[] {
    return this.relationships;
  }
}

// Helper to create wiring
export function wire(): WiringBuilder {
  return new WiringBuilder();
}