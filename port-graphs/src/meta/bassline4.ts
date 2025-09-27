/**
 * Bassline4 - Generic composition pattern for gadget systems
 *
 * Like relations, a bassline works with ANY gadgets that fulfill the conceptual roles.
 * It doesn't care about specific implementations, only that the types fit.
 */

import { defGadget, withTaps, type Gadget, type State, type Input, type Actions, type Effects, type Tappable, type EffectsOf } from '../core/typed';
import { lastTable, type TableSpec } from '../patterns/cells/tables';
import { extract, transform } from '../relations';

/**
 * Type constraints for conceptual roles
 */

// Definitions role: stores name -> factory mappings, emits changes
type DefinitionsRole<T = Record<string, Function>> =
  Gadget<State<T> & Effects<{ added?: T; removed?: T; changed?: T }>> & Tappable<any>;

// Instances role: stores id -> gadget mappings, emits changes
type InstancesRole<T = Record<string, Gadget<unknown>>> =
  Gadget<State<T> & Effects<{ added?: T; removed?: T; changed?: T }>> & Tappable<any>;

// Edges role: stores edge_id -> edge data, emits changes
type EdgesRole<T = Record<string, any>> =
  Gadget<State<T> & Effects<{ added?: T; removed?: T; changed?: T }>> & Tappable<any>;

// Patterns role: stores pattern_name -> function mappings
type PatternsRole<T = Record<string, Function>> =
  Gadget<State<T>>;

/**
 * Generic factory processor - works with any gadgets that fit the roles
 */
function factoryProcessor<
  D extends DefinitionsRole,
  I extends InstancesRole
>(deps: {
  definitions: D;
  instances: I;
}) {
  type FactoryProcessorSpec =
    & State<{ definitions: D; instances: I }>
    & Input<{ create: { id: string; type: string; args?: unknown[] } }>
    & Actions<{ create: { id: string; type: string; args?: unknown[] } }>
    & Effects<{
      created: { id: string; type: string };
      notFound: { type: string };
    }>;

  return defGadget<FactoryProcessorSpec>({
    dispatch: (_state, input) => {
      if ('create' in input) return { create: input.create };
      return null;
    },
    methods: {
      create: (gadget, { id, type, args = [] }) => {
        const definitions = gadget.current().definitions.current() as Record<string, Function>;
        const factory = definitions[type];

        if (!factory) return { notFound: { type } };

        const instance = withTaps(factory(...args));
        // Use the instances gadget's receive method - it could be any implementation
        (gadget.current().instances as any).receive({ [id]: instance });

        return { created: { id, type } };
      }
    }
  })(deps);
}

/**
 * Generic wiring processor - works with any gadgets that fit the roles
 */
function wiringProcessor<
  I extends InstancesRole,
  P extends PatternsRole
>(deps: {
  instances: I;
  patterns: P;
}) {
  type WiringProcessorSpec =
    & State<{
      instances: I;
      patterns: P;
      cleanups: Map<string, () => void>;
    }>
    & Input<
      | { wire: Record<string, any> }
      | { unwire: Record<string, any> }
    >
    & Actions<{
      wire: { id: string; edge: any };
      unwire: { id: string };
    }>
    & Effects<{
      wired: { id: string; from: string; to: string };
      unwired: { id: string };
      notFound: { from?: string; to?: string; pattern?: string };
    }>;

  return defGadget<WiringProcessorSpec>({
    dispatch: (_state, input) => {
      if ('wire' in input) {
        for (const [id, edge] of Object.entries(input.wire)) {
          return { wire: { id, edge } };
        }
      }
      if ('unwire' in input) {
        for (const id of Object.keys(input.unwire)) {
          return { unwire: { id } };
        }
      }
      return null;
    },
    methods: {
      wire: (gadget, { id, edge }) => {
        const instances = gadget.current().instances.current() as Record<string, Gadget<unknown>>;
        const fromGadget = instances[edge.from];
        const toGadget = instances[edge.to];

        if (!fromGadget) return { notFound: { from: edge.from } };
        if (!toGadget) return { notFound: { to: edge.to } };

        // Determine wiring pattern from edge metadata
        let cleanup: () => void;

        if (edge.transform && typeof edge.transform === 'function') {
          const field = edge.field || 'changed';
          const relation = transform(fromGadget as any, field, edge.transform, toGadget);
          cleanup = relation.cleanup;
        } else if (edge.field) {
          const relation = extract(fromGadget as any, edge.field, toGadget);
          cleanup = relation.cleanup;
        } else {
          const relation = extract(fromGadget as any, 'changed', toGadget);
          cleanup = relation.cleanup;
        }

        gadget.current().cleanups.set(id, cleanup);
        return { wired: { id, from: edge.from, to: edge.to } };
      },

      unwire: (gadget, { id }) => {
        const cleanup = gadget.current().cleanups.get(id);
        if (cleanup) {
          cleanup();
          gadget.current().cleanups.delete(id);
        }
        return { unwired: { id } };
      }
    }
  })({ ...deps, cleanups: new Map() });
}

/**
 * Generic bassline - works with ANY gadgets that fulfill the conceptual roles
 */
export function bassline<
  D extends DefinitionsRole,
  I extends InstancesRole,
  E extends EdgesRole,
  P extends PatternsRole
>(config: {
  definitions: D;
  instances: I;
  edges: E;
  patterns: P;
}) {
  const { definitions, instances, edges, patterns } = config;

  // Create the processors
  const factory = withTaps(factoryProcessor({ definitions, instances }));
  const wiring = withTaps(wiringProcessor({ instances, patterns }));

  // Wire the processors to observe table changes
  // This IS the bassline - this specific pattern of connections
  edges.tap((effects: any) => {
    if (effects.added) {
      wiring.receive({ wire: effects.added });
    }
    if (effects.removed) {
      wiring.receive({ unwire: effects.removed });
    }
  });

  // Return the composed system
  return {
    definitions,
    instances,
    edges,
    patterns,
    factory,
    wiring,

    // Convenience methods
    create: (id: string, type: string, args: unknown[] = []) => {
      factory.receive({ create: { id, type, args } });
    },
    wire: (id: string, from: string, to: string, metadata: any = {}) => {
      (edges as any).receive({ [id]: { from, to, ...metadata } });
    },
    disconnect: (id: string) => {
      (edges as any).receive({ [id]: null });
    },
    destroy: (id: string) => {
      (instances as any).receive({ [id]: null });

      // Remove any edges involving this instance
      const currentEdges = (edges.current as any)() as Record<string, any>;
      const toRemove: Record<string, null> = {};
      for (const [edgeId, edge] of Object.entries(currentEdges)) {
        if (edge?.from === id || edge?.to === id) {
          toRemove[edgeId] = null;
        }
      }
      if (Object.keys(toRemove).length > 0) {
        (edges as any).receive(toRemove);
      }
    }
  };
}

/**
 * Convenience function that creates a bassline with standard table implementations
 */
export function basslineGadget(config: {
  factories?: Record<string, Function>;
  patterns?: Record<string, Function>;
} = {}) {
  return bassline({
    definitions: withTaps(lastTable<string, Function>(config.factories || {})),
    instances: withTaps(lastTable<string, Gadget<unknown>>({})),
    edges: withTaps(lastTable<string, any>({})),
    patterns: withTaps(lastTable<string, Function>(config.patterns || { extract, transform }))
  });
}