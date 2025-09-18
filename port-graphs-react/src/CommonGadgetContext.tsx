/**
 * Dead simple context for sharing a gadget reference across components
 */

import { createContext, useContext } from 'react';
import type { Tappable } from 'port-graphs';

const CommonGadgetContext = createContext<Tappable | undefined>(undefined);

export const CommonGadgetProvider = CommonGadgetContext.Provider;

export function useCommonGadget(): Tappable {
  const gadget = useContext(CommonGadgetContext);
  if (!gadget) {
    throw new Error('useCommonGadget must be used within CommonGadgetProvider');
  }
  return gadget;
}