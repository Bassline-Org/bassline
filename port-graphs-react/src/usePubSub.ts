import { useCallback, useEffect, useRef } from 'react';
import { usePubSubContext } from './PubSubProvider';
import type { Gadget } from 'port-graphs';

export function useRegistry(gadget: Gadget<any, any, any> | null, id: string) {
  const { registry, pubsub, subscriptions } = usePubSubContext();
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

    return () => {
      registry.receive({ [id]: undefined });
    };
  }, [gadgetRef, registry]);

  const publish = useCallback((data: any, topic: string) => {
    pubsub.receive({ command: { type: 'publish', topic, data } });
  }, [pubsub]);

  const subscribe = useCallback((topic: string) => {
    subscriptions.receive({ type: 'subscribe', topic, subscriber: id });
  }, [subscriptions]);

  return { publish, subscribe };
}