/**
 * CSP DSL Gadget
 *
 * Implements the CSP (Constraint Satisfaction Problem) Language
 *
 * Purpose: Express constraint problems in domain vocabulary
 * Compilation: Forwards to Network DSL
 */

import { protoGadget, quick, withTaps } from '../../../core/context';
import { createNetworkGadget } from '../network/network';

// ================================================
// Types
// ================================================

export type CSPInput =
  | { variable: { name: string; domain: () => any } }
  | { create: { id: string; type: string; domain?: any } }
  | { relate: { vars: string[]; constraint: (...domains: any[]) => any[] } };

export type CSPActions =
  | { defineVariable: { name: string; domain: () => any } }
  | { createVariable: { id: string; type: string; domain?: any; factory: () => any } }
  | { createRelation: { vars: string[]; constraint: (...domains: any[]) => any[]; varGadgets: any[] } }
  | { error: { type: string; details: string } };

export type CSPEffects = {
  variableDefined?: { name: string };
  created?: { id: string };
  related?: { vars: string[] };
  error?: { type: string; details: string };
};

export type CSPState = {
  network: ReturnType<typeof createNetworkGadget>;
};

// ================================================
// Step - Validation & Preparation
// ================================================

export const cspStep = (state: CSPState, input: CSPInput): CSPActions => {
  // Variable definition - just pass through
  if ('variable' in input) {
    return { defineVariable: input.variable };
  }

  // Variable creation - lookup factory
  if ('create' in input) {
    const { id, type, domain } = input.create;
    const factory = state.network.current().definitions.current().get(type);

    if (!factory) {
      return { error: { type: 'unknown_type', details: `No factory for type: ${type}` } };
    }

    return { createVariable: { id, type, domain, factory } };
  }

  // Relation creation - validate variables exist
  if ('relate' in input) {
    const { vars, constraint } = input.relate;
    const instances = state.network.current().spawning.current().instances.current();

    const varGadgets = vars.map(v => instances.get(v));

    // Check all variables exist
    for (let i = 0; i < vars.length; i++) {
      if (!varGadgets[i]) {
        return {
          error: {
            type: 'variable_not_found',
            details: `Variable not found: ${vars[i]}`
          }
        };
      }
    }

    return { createRelation: { vars, constraint, varGadgets } };
  }

  return { error: { type: 'unknown_command', details: 'Unknown CSP command' } };
};

// ================================================
// Handlers - Forward to Network DSL
// ================================================

export function defineVariableHandler(
  g: { current: () => CSPState },
  actions: CSPActions
): Partial<CSPEffects> {
  if ('defineVariable' in actions) {
    const { name, domain } = actions.defineVariable;

    // FORWARD to network: define factory
    g.current().network.receive({
      define: { name, factory: domain }
    });

    return { variableDefined: { name } };
  }
  return {};
}

export function createVariableHandler(
  g: { current: () => CSPState },
  actions: CSPActions
): Partial<CSPEffects> {
  if ('createVariable' in actions) {
    const { id, type, domain } = actions.createVariable;

    // FORWARD to network: spawn instance
    g.current().network.receive({
      spawn: { id, type }
    });

    // If domain provided, send it to the instance
    if (domain !== undefined) {
      const instances = g.current().network.current().spawning.current().instances.current();
      const instance = instances.get(id);
      if (instance && typeof instance.receive === 'function') {
        instance.receive(domain);
      }
    }

    return { created: { id } };
  }
  return {};
}

export function createRelationHandler(
  g: { current: () => CSPState },
  actions: CSPActions
): Partial<CSPEffects> {
  if ('createRelation' in actions) {
    const { vars, constraint, varGadgets } = actions.createRelation;

    // Create propagator gadget
    const propId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const propName = `propagator_${propId}`;

    // Define propagator factory
    const propagatorFactory = () => {
      // Create propagator gadget that applies constraint
      const propagator = withTaps(
        quick(
          protoGadget<any>((state, input) => {
            // When any variable changes, apply constraint
            return { propagate: input };
          }).handler((gadget, actions) => {
            if ('propagate' in actions) {
              // Get current domains from all variables
              const domains = varGadgets.map((v: any) => v.current());

              // Apply constraint
              const refined = constraint(...domains);

              // Build effects with refined domains for each var
              const effects: any = {};
              vars.forEach((varId, i) => {
                effects[`${varId}_refined`] = refined[i];
              });

              return effects;
            }
            return {};
          }),
          undefined
        )
      );

      return propagator;
    };

    // FORWARD to network: define propagator
    g.current().network.receive({
      define: { name: propName, factory: propagatorFactory }
    });

    // FORWARD to network: spawn propagator
    g.current().network.receive({
      spawn: { id: propId, type: propName }
    });

    // Get propagator instance
    const instances = g.current().network.current().spawning.current().instances.current();
    const propagator = instances.get(propId);

    // FORWARD to network: wire each variable to propagator
    vars.forEach((varId, i) => {
      // Variable -> Propagator
      g.current().network.receive({
        wire: { from: varId, to: propId, via: 'changed' }
      });

      // Propagator -> Variable (refined domain)
      g.current().network.receive({
        wire: { from: propId, to: varId, via: `${varId}_refined` }
      });
    });

    return { related: { vars } };
  }
  return {};
}

export function errorHandler(
  _g: { current: () => CSPState },
  actions: CSPActions
): Partial<CSPEffects> {
  if ('error' in actions) {
    return { error: actions.error };
  }
  return {};
}

// ================================================
// Proto-Gadget - Compose Handlers
// ================================================

export const cspProto = () =>
  protoGadget(cspStep).handler((g, actions) => ({
    ...defineVariableHandler(g, actions),
    ...createVariableHandler(g, actions),
    ...createRelationHandler(g, actions),
    ...errorHandler(g, actions)
  }));

// ================================================
// Factory
// ================================================

/**
 * Create a CSP DSL gadget
 *
 * @returns A gadget implementing the CSP Language
 */
export function createCSPGadget() {
  const initialState: CSPState = {
    network: createNetworkGadget()
  };

  return withTaps(quick(cspProto(), initialState));
}
