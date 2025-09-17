export * from './registry';
export * from './lookup';

import { registry, announcer } from './registry';
import { lookup } from './lookup';
import { Gadget } from '../../core';

/**
 * Wire a discovery system together
 *
 * Creates registry, lookup, and announcement gadgets wired together
 */
export function createDiscoverySystem() {
  const reg = registry({});
  const look = lookup({ cache: {}, pending: {} });

  // Wire lookup to registry
  look.emit = (effect: any) => {
    if (effect?.changed?.lookup) {
      reg.receive({ lookup: effect.changed.lookup });
    }
  };

  // Wire registry query responses back to lookup
  reg.emit = (effect: any) => {
    if (effect?.changed?.found) {
      look.receive({ found: effect.changed.found });
    } else if (effect?.changed?.notFound) {
      look.receive({ notFound: effect.changed.notFound });
    }
  };

  return { registry: reg, lookup: look };
}

/**
 * Register a gadget with a name
 */
export function registerGadget(reg: Gadget, name: string, gadget: Gadget, metadata?: any) {
  reg.receive({
    name,
    endpoint: gadget,
    metadata: metadata || {}
  });
}

/**
 * Resolve a name to a gadget
 */
export async function resolveGadget(look: Gadget, name: string): Promise<Gadget | null> {
  return new Promise((resolve) => {
    const originalEmit = look.emit;
    look.emit = (effect: any) => {
      originalEmit(effect);
      if (effect?.changed?.resolved && effect.changed.resolved.name === name) {
        resolve(effect.changed.resolved.endpoint);
        look.emit = originalEmit; // Restore
      } else if (effect?.changed?.failed === name) {
        resolve(null);
        look.emit = originalEmit; // Restore
      }
    };
    look.receive({ resolve: name });
  });
}