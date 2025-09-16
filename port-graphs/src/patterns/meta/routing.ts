/**
 * PubSub infrastructure using existing gadget patterns
 *
 * A minimal pubsub system built from cells and functions.
 * Topics are just keys, subscribers are arrays of gadget IDs.
 */

import _ from "lodash";
import { createGadget, type Gadget } from "../../core";
import { changed } from "../../effects";
import { firstMap } from "../cells/maps";
import { createFn } from "../functions/numeric";
import { extendGadget } from "../../semantics";

// PubSub command types
export type PubSubCommand =
  | { type: 'publish'; data: any; source: string };

export type SubscriptionCommand =
  | { type: 'subscribe'; topic: string; subscriber: string }
  | { type: 'unsubscribe'; topic: string; subscriber: string }

export type PublisherCommand =
  | { type: 'add_topics'; topics: string[], publisher: string }
  | { type: 'remove_topics'; topics: string[], publisher: string }

// Subscriptions type: topic -> array of subscribers
export type Subscriptions = Record<string, string[]>;
export type Publishers = Record<string, string[]>;

// Registry is just a firstMap that accumulates gadget references
export type Registry = Record<string, Gadget>;

/**
 * Subscriptions cell - manages topic subscriptions
 * Handles subscribe/unsubscribe commands
 */
export const subscriptions = createGadget<Subscriptions, SubscriptionCommand>(
  (subs, cmd) => {
    switch (cmd.type) {
      case 'subscribe': {
        const subscribers = subs[cmd.topic];
        if (subscribers?.includes(cmd.subscriber)) {
          return null; // Already subscribed
        }
        return { action: 'add_subscription', context: { ...cmd, subs } };
      }

      case 'unsubscribe': {
        const subscribers = subs[cmd.topic];
        if (!subscribers?.includes(cmd.subscriber)) {
          return null; // Not subscribed
        }
        return { action: 'remove_subscription', context: { ...cmd, subs } };
      }

      default:
        return null; // Ignore publish - that goes to pubsub function
    }
  },
  {
    'add_subscription': (gadget, { topic, subscriber, subs }) => {
      const subscribers = subs[topic] || [];
      subs[topic] = [...subscribers, subscriber];
      gadget.update(subs);
      return changed(subs);
    },

    'remove_subscription': (gadget, { topic, subscriber, subs }) => {
      const subscribers = subs[topic];
      if (subscribers) {
        subs[topic] = subscribers.filter((s: string) => s !== subscriber);
        if (subs[topic].length === 0) {
          delete subs[topic];
        }
      }
      gadget.update(subs);
      return changed(subs);
    }
  }
);

export const publishers = createGadget<Publishers, PublisherCommand>(
  (publishers, cmd) => {
    switch (cmd.type) {
      case 'add_topics':
        return { action: 'add_topics', context: { ...cmd, publishers } };
      case 'remove_topics':
        return { action: 'remove_topics', context: { ...cmd, publishers } };
      default:
        return null;
    }
  },
  {
    'add_topics': (gadget, { topics, publisher, publishers }) => {
      publishers[publisher] = { ...publishers[publisher], topics };
      gadget.update(publishers);
      return changed(publishers);
    },
    'remove_topics': (gadget, { topics, publisher, publishers }) => {
      publishers[publisher] = { ...publishers[publisher], topics: publishers[publisher].topics.filter((t: string) => !topics.includes(t)) };
      gadget.update(publishers);
      return changed(publishers);
    }
  }
);

/**
 * PubSub function gadget - publishes messages to topic subscribers
 *
 * Takes 3 arguments:
 * - subscriptions: The current subscriptions table
 * - gadgets: The registry of gadgets
 * - command: The pubsub command to execute
 */
export const createPubSub = createFn<
  {
    subscriptions: Subscriptions;
    gadgets: Registry;
    publishers: Publishers;
    command: PubSubCommand;
  },
  { delivered: string[] } | null
>(
  ({ subscriptions, gadgets, command, publishers }) => {
    // Only handle publish commands
    if (!command || command.type !== 'publish') {
      return null;
    }

    const topics = publishers[command.source] || [];
    const subscribers = topics.flatMap(topic => subscriptions[topic] || []);
    if (!subscribers || subscribers.length === 0) {
      return null; // No subscribers
    }

    const delivered: string[] = [];

    for (const subscriberId of subscribers) {
      const gadget = gadgets[subscriberId];
      if (gadget) {
        gadget.receive(command.data);
        delivered.push(subscriberId);
      }
    }

    return delivered.length > 0 ? { delivered } : null;
  },
  ['subscriptions', 'gadgets', 'command']
);

/**
 * Helper to create a complete pubsub system
 * Returns registry, subscriptions, and pubsub all wired together
 */
export function createPubSubSystem() {
  // Create the components
  const registry = firstMap({} as Registry);
  const subs = subscriptions({});
  const pubs = publishers({});
  const pubsub = createPubSub({
    subscriptions: {},
    gadgets: {},
    command: null as any // Start with null command
  });

  // Wire them together
  // When registry changes, update pubsub's gadgets argument
  extendGadget(registry)(effect => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      pubsub.receive({ gadgets: effect.changed as Registry });
    }
  })

  // When subscriptions change, update pubsub's subscriptions argument
  extendGadget(subs)(effect => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      pubsub.receive({ subscriptions: effect.changed as Subscriptions });
    }
  });

  // When publishers change, update pubsub's publishers argument
  extendGadget(pubs)(effect => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      pubsub.receive({ publishers: effect.changed as Publishers });
    }
  });

  return { registry, subscriptions: subs, publishers: pubs, pubsub };
}