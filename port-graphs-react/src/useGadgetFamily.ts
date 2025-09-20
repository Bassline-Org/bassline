/**
 * React hook for using gadget families
 *
 * This hook makes it easy to get gadgets from a family gadget,
 * creating them synchronously if they don't exist.
 */

import type { Gadget } from 'port-graphs';

/**
 * Get a gadget from a family, creating it if necessary.
 * This is completely synchronous - no loading states needed!
 *
 * @param family - The family gadget
 * @param key - The key to get/create a gadget for
 * @returns The gadget for this key
 *
 * @example
 * const nodeFamily = createFamily((id: string) => withTaps(lastCell(0)));
 *
 * function Node({id}: {id: string}) {
 *   const nodeGadget = useGadgetFromFamily(nodeFamily, id);
 *   const [state, send] = useGadget(nodeGadget);
 *   return <div>{state}</div>;
 * }
 */
export function useGadgetFromFamily<K extends string | number, G extends Gadget>(
  family: Gadget<any, { get: K }, any>,
  key: K
): G {
  // Check if gadget already exists
  const familyState = family.current();
  let gadget = familyState.gadgets?.get(key) as G | undefined;

  // If not, create it synchronously
  if (!gadget) {
    family.receive({ get: key });
    // Get the newly created gadget
    gadget = family.current().gadgets?.get(key) as G;
  }

  return gadget;
}

/**
 * Get multiple gadgets from a family at once.
 * All gadgets are created synchronously if needed.
 *
 * @param family - The family gadget
 * @param keys - Array of keys to get gadgets for
 * @returns Map of key to gadget
 *
 * @example
 * const nodeFamily = createFamily((id: string) => withTaps(lastCell(0)));
 *
 * function NodeGroup({ids}: {ids: string[]}) {
 *   const gadgets = useGadgetsFromFamily(nodeFamily, ids);
 *
 *   return (
 *     <div>
 *       {ids.map(id => {
 *         const gadget = gadgets.get(id);
 *         return <NodeDisplay key={id} gadget={gadget!} />;
 *       })}
 *     </div>
 *   );
 * }
 */
export function useGadgetsFromFamily<K extends string | number, G extends Gadget>(
  family: Gadget<any, { get: K }, any>,
  keys: K[]
): Map<K, G> {
  const gadgets = new Map<K, G>();

  keys.forEach(key => {
    // Check if gadget exists
    let gadget = family.current().gadgets?.get(key) as G | undefined;

    // If not, create it
    if (!gadget) {
      family.receive({ get: key });
      gadget = family.current().gadgets?.get(key) as G;
    }

    if (gadget) {
      gadgets.set(key, gadget);
    }
  });

  return gadgets;
}