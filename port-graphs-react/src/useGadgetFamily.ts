/**
 * React hook for using gadget families
 *
 * This hook makes it easy to get gadgets from a family gadget,
 * handling the async nature of gadget creation and cleanup.
 */

import { useEffect, useState } from 'react';
import { useTap } from './useTap';
import type { Gadget } from 'port-graphs';

/**
 * Get a gadget from a family, creating it if necessary.
 *
 * @param family - The family gadget
 * @param key - The key to get/create a gadget for
 * @returns The gadget for this key, or undefined while loading
 *
 * @example
 * const nodeFamily = createFamily((id: string) => lastCell(0));
 *
 * function Node({id}: {id: string}) {
 *   const nodeGadget = useGadgetFromFamily(nodeFamily, id);
 *   if (!nodeGadget) return <div>Loading...</div>;
 *
 *   const [state, send] = useGadget(nodeGadget);
 *   return <div>{state}</div>;
 * }
 */
export function useGadgetFromFamily<K extends string | number, G extends Gadget>(
  family: Gadget<any, { get: K }, any>,
  key: K
): G | undefined {
  const [gadget, setGadget] = useState<G | undefined>(undefined);

  // Request the gadget from the family
  useEffect(() => {
    family.receive({ get: key });
  }, [family, key]);

  // Listen for the gadget to be created or returned
  useTap(family as any, (effect: any) => {
    if (effect?.created?.key === key) {
      setGadget(effect.created.gadget as G);
    } else if (effect?.existing?.key === key) {
      setGadget(effect.existing.gadget as G);
    }
  }, [key]);

  return gadget;
}

/**
 * Get multiple gadgets from a family at once.
 *
 * @param family - The family gadget
 * @param keys - Array of keys to get gadgets for
 * @returns Map of key to gadget (may be incomplete while loading)
 *
 * @example
 * const nodeFamily = createFamily((id: string) => lastCell(0));
 *
 * function NodeGroup({ids}: {ids: string[]}) {
 *   const gadgets = useGadgetsFromFamily(nodeFamily, ids);
 *
 *   return (
 *     <div>
 *       {ids.map(id => {
 *         const gadget = gadgets.get(id);
 *         if (!gadget) return null;
 *         return <NodeDisplay key={id} gadget={gadget} />;
 *       })}
 *     </div>
 *   );
 * }
 */
export function useGadgetsFromFamily<K extends string | number, G extends Gadget>(
  family: Gadget<any, { get: K }, any>,
  keys: K[]
): Map<K, G> {
  const [gadgets, setGadgets] = useState<Map<K, G>>(new Map());

  // Request all gadgets from the family
  useEffect(() => {
    keys.forEach(key => {
      family.receive({ get: key });
    });
  }, [family, ...keys]);

  // Listen for gadgets to be created or returned
  useTap(family as any, (effect: any) => {
    if (effect?.created && keys.includes(effect.created.key)) {
      setGadgets(prev => {
        const next = new Map(prev);
        next.set(effect.created.key, effect.created.gadget as G);
        return next;
      });
    } else if (effect?.existing && keys.includes(effect.existing.key)) {
      setGadgets(prev => {
        const next = new Map(prev);
        next.set(effect.existing.key, effect.existing.gadget as G);
        return next;
      });
    }
  }, [keys.join(',')]); // Use string key for stable dependency

  return gadgets;
}