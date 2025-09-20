/**
 * React hook for integrating gadgets with React state management
 *
 * This hook supports both direct gadgets and family gadgets with keys.
 * All gadgets are managed through the GadgetProvider for consistent state.
 */

import { type Gadget, type Tappable } from 'port-graphs';
import { useGadgetFromProvider } from './GadgetProvider';

// Type to check if something is a family gadget
type FamilyGadget<K extends string | number = string | number> = Gadget<
  { gadgets: Map<K, any>; factory: () => any },
  { get: K } | { delete: K } | { clear: true },
  any
>;

function isFamily(gadget: any): gadget is FamilyGadget {
  return gadget?.current?.()?.gadgets instanceof Map && typeof gadget?.current?.()?.factory === 'function';
}

/**
 * React hook for using gadgets with automatic state management.
 * Supports both direct gadgets and family gadgets.
 *
 * @example
 * // Direct gadget
 * const [value, send] = useGadget(counterGadget);
 *
 * @example
 * // Family gadget with key
 * const [value, send] = useGadget(nodeFamily, 'node-1');
 */
export function useGadget<State, Incoming = any, Effect = any>(
  gadget: Gadget<State, Incoming, Effect>
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>];

export function useGadget<K extends string | number, State, Incoming = any, Effect = any>(
  family: FamilyGadget<K>,
  key: K
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>];

export function useGadget<State, Incoming = any, Effect = any>(
  gadgetOrFamily: Gadget<State, Incoming, Effect> | FamilyGadget,
  key?: string | number
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>] {
  // Handle family gadgets
  if (isFamily(gadgetOrFamily) && key !== undefined) {
    // Get or create the gadget from the family
    const familyState = gadgetOrFamily.current();
    let gadget = familyState.gadgets?.get(key) as Gadget<State, Incoming, Effect> | undefined;

    if (!gadget) {
      // Create the gadget
      gadgetOrFamily.receive({ get: key });
      gadget = gadgetOrFamily.current().gadgets?.get(key) as Gadget<State, Incoming, Effect>;
    }

    if (!gadget) {
      throw new Error(`Failed to create gadget for key: ${key}`);
    }

    // Use the provider for state management
    return useGadgetFromProvider(gadget);
  }

  // Handle direct gadgets
  if (!isFamily(gadgetOrFamily) && key === undefined) {
    return useGadgetFromProvider(gadgetOrFamily);
  }

  // Error cases
  if (isFamily(gadgetOrFamily) && key === undefined) {
    throw new Error('Family gadgets require a key parameter');
  }

  if (!isFamily(gadgetOrFamily) && key !== undefined) {
    throw new Error('Direct gadgets do not accept a key parameter');
  }

  throw new Error('Invalid useGadget call');
}