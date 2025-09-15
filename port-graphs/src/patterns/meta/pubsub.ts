/**
 * PubSub Meta-Gadget
 *
 * A gadget that manages publish-subscribe relationships.
 * It doesn't do routing itself - it just tracks subscriptions and emits routing instructions.
 * This demonstrates layered meta-gadgets: pubsub emits data that router consumes.
 */

import { createGadget, type Gadget } from "../../core";
import { changed } from "../../effects";
import type { RouteCommand } from "./router";

// PubSub command types
export type PubSubCommand =
  | { type: 'subscribe'; topic: string; subscriber: string }
  | { type: 'unsubscribe'; topic: string; subscriber: string }
  | { type: 'publish'; topic: string; data: any };

// Subscription table: topic -> set of subscriber IDs
export type Subscriptions = Map<string, Set<string>>;

/**
 * Creates a pubsub system that emits routing instructions
 * Wire this to a router to actually deliver messages!
 */
export const pubsub = createGadget<Subscriptions, PubSubCommand>(
  (subs, cmd) => {
    switch (cmd.type) {
      case 'subscribe': {
        const subscribers = subs.get(cmd.topic);
        if (subscribers?.has(cmd.subscriber)) {
          return null; // Already subscribed
        }
        return { action: 'add_subscription', context: cmd };
      }

      case 'unsubscribe': {
        const subscribers = subs.get(cmd.topic);
        if (!subscribers?.has(cmd.subscriber)) {
          return null; // Not subscribed
        }
        return { action: 'remove_subscription', context: cmd };
      }

      case 'publish': {
        const subscribers = subs.get(cmd.topic);
        if (!subscribers || subscribers.size === 0) {
          return null; // No subscribers
        }
        return {
          action: 'notify_subscribers',
          context: { ...cmd, subscribers: Array.from(subscribers) }
        };
      }

      default:
        return null;
    }
  },
  {
    'add_subscription': (gadget, context) => {
      const subs = new Map(gadget.current());

      // Add the subscription
      const subscribers = subs.get(context.topic) || new Set();
      subscribers.add(context.subscriber);
      subs.set(context.topic, subscribers);

      gadget.update(subs);

      // Emit routing instruction to connect topic to subscriber
      const routeCmd: RouteCommand = {
        type: 'connect',
        from: context.topic,
        to: context.subscriber
      };

      return changed({
        subscribed: { topic: context.topic, subscriber: context.subscriber },
        route: routeCmd
      });
    },

    'remove_subscription': (gadget, context) => {
      const subs = new Map(gadget.current());

      // Remove the subscription
      const subscribers = subs.get(context.topic);
      if (subscribers) {
        subscribers.delete(context.subscriber);
        if (subscribers.size === 0) {
          subs.delete(context.topic);
        }
      }

      gadget.update(subs);

      // Emit routing instruction to disconnect
      const routeCmd: RouteCommand = {
        type: 'disconnect',
        from: context.topic,
        to: context.subscriber
      };

      return changed({
        unsubscribed: { topic: context.topic, subscriber: context.subscriber },
        route: routeCmd
      });
    },

    'notify_subscribers': (_gadget, context) => {
      // Don't actually send messages - emit routing instruction!
      const routeCmd: RouteCommand = {
        type: 'send',
        from: context.topic,
        to: context.subscribers,
        data: context.data
      };

      return changed({
        published: {
          topic: context.topic,
          subscribers: context.subscribers.length,
          data: context.data
        },
        route: routeCmd
      });
    }
  }
);

/**
 * Helper to create a pubsub system
 */
export function createPubSub(): Gadget<Subscriptions, PubSubCommand> {
  return pubsub(new Map());
}

/**
 * Helper to wire pubsub to a router
 * Extracts routing commands from pubsub effects and sends them to the router
 */
export function connectPubSubToRouter(
  pubsubGadget: Gadget,
  routerGadget: Gadget<any, RouteCommand>
) {
  // Intercept pubsub's emit to extract routing commands
  const originalEmit = pubsubGadget.emit;
  pubsubGadget.emit = (effect: any) => {
    // Call original emit
    originalEmit(effect);

    // If the effect contains a route command, send it to the router
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      const changed = effect.changed;
      if (changed && typeof changed === 'object' && 'route' in changed) {
        routerGadget.receive(changed.route);
      }
    }
  };
}