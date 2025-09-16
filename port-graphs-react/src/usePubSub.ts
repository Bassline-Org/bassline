import { useEffect, useRef } from 'react';
import { usePubSubContext } from './PubSubProvider';
import type { Gadget } from 'port-graphs';

/**
 * Hook to publish gadget changes to a topic
 * Whenever the gadget's state changes, it publishes to the topic
 */
export function usePub(gadget: Gadget<any, any, any>, topic: string) {
  const { pubsub } = usePubSubContext();
  const lastValueRef = useRef<any>();

  useEffect(() => {
    // Monitor gadget for changes and publish them
    const originalEmit = gadget.emit;
    gadget.emit = (effect) => {
      originalEmit.call(gadget, effect);

      // When gadget changes, publish to topic
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        const newValue = effect.changed;
        if (newValue !== lastValueRef.current) {
          lastValueRef.current = newValue;
          pubsub.receive({ command: { type: 'publish', topic, data: newValue } });
        }
      }
    };

    // Cleanup: restore original emit
    return () => {
      gadget.emit = originalEmit;
    };
  }, [gadget, topic, pubsub]);
}

/**
 * Hook to subscribe a gadget to a topic
 * Whenever the topic receives data, it updates the gadget
 */
export function useSub(gadget: Gadget<any, any, any>, topic: string) {
  const { registry, subscriptions: subs } = usePubSubContext();

  useEffect(() => {
    // Generate unique subscriber ID
    const subscriberId = `${topic}-${Math.random().toString(36).substring(7)}`;

    // Register the gadget
    registry.receive({ [subscriberId]: gadget });

    // Subscribe to the topic
    subs.receive({ type: 'subscribe', topic, subscriber: subscriberId });

    // Cleanup
    return () => {
      subs.receive({ type: 'unsubscribe', topic, subscriber: subscriberId });
      registry.receive({ [subscriberId]: undefined });
    };
  }, [gadget, topic, registry, subs]);
}

/**
 * Hook for bidirectional pubsub - both publishes changes and receives updates
 */
export function usePubSub(gadget: Gadget<any, any, any>, topic: string) {
  usePub(gadget, topic);
  useSub(gadget, topic);
}