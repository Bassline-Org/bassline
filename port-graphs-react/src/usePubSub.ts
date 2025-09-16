import { useCallback, useEffect, useRef } from 'react';
import { usePubSubContext } from './PubSubProvider';
import { extendGadget, type Gadget } from 'port-graphs';

export function useRegistry(gadget: Gadget<any, any, any> | null, id: string) {
  const { registry, subscriptions, publishers, pubsub } = usePubSubContext();
  const gadgetRef = useRef<typeof gadget>(gadget);

  useEffect(() => {
    if (!gadgetRef.current) {
      const g = registry.current()[id];
      if (!g) {
        throw new Error(`Gadget ${id} not found in registry`);
      }
      gadgetRef.current = g;
    }

    registry.receive({ [id]: gadgetRef.current });

    extendGadget(gadgetRef.current!)(effect => {
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        if (publishers.current()[id]) {
          pubsub.receive({ command: { type: 'publish', data: effect.changed, source: id } });
        }
      }
    });

    return () => {
      registry.receive({ [id]: undefined });
    };
  }, [gadgetRef, registry]);

  const addTopics = useCallback((...topics: string[]) => {
    publishers.receive({ type: 'add_topics', topics, publisher: id });
  }, [registry]);

  const removeTopics = useCallback((...topics: string[]) => {
    publishers.receive({ type: 'remove_topics', topics, publisher: id });
  }, [publishers]);

  const subscribe = useCallback((topic: string) => {
    subscriptions.receive({ type: 'subscribe', topic, subscriber: id });
  }, [subscriptions]);

  const unsubscribe = useCallback((topic: string) => {
    subscriptions.receive({ type: 'unsubscribe', topic, subscriber: id });
  }, [subscriptions]);

  return { subscribe, unsubscribe, addTopics, removeTopics };
}