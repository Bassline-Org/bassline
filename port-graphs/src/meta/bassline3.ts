/**
 * Bassline3 - A clean composition pattern for gadget systems
 *
 * A bassline is NOT a gadget - it's a wiring pattern between orthogonal components:
 * - definitions table: name → factory
 * - instances table: id → gadget instance
 * - edges table: edge_id → {from, to, ...metadata}
 * - patterns table: pattern_name → wiring function
 *
 * The magic is that ANY gadget can fill these roles.
 */

import { defGadget, withTaps, type Gadget, type State, type Input, type Actions, type Effects } from '../core/typed';
import { lastTable, type TableSpec } from '../patterns/cells/tables';
import { extract, transform } from '../relations';

/**
 * Edge data - pure topology with optional metadata
 */
type Edge = {
  from: string;
  to: string;
  field?: string;
  transform?: Function;
  [key: string]: unknown; // Allow arbitrary metadata
};

/**
 * Factory processor - creates instances from factories
 */
type FactoryProcessorSpec =
  & State<{
    definitions: Gadget<TableSpec<string, Function>>;
    instances: Gadget<TableSpec<string, Gadget<unknown>>>;
  }>
  & Input<{ create: { id: string; type: string; args?: unknown[] } }>
  & Actions<{ create: { id: string; type: string; args?: unknown[] } }>
  & Effects<{
    created: { id: string; type: string };
    notFound: { type: string };
  }>;

function factoryProcessor(deps: {
  definitions: Gadget<TableSpec<string, Function>>;
  instances: Gadget<TableSpec<string, Gadget<unknown>>>;
}) {
  return defGadget<FactoryProcessorSpec>({
    dispatch: (_state, input) => {
      if ('create' in input) return { create: input.create };
      return null;
    },
    methods: {
      create: (gadget, { id, type, args = [] }) => {
        const factory = gadget.current().definitions.current()[type];
        if (!factory) return { notFound: { type } };

        const instance = withTaps(factory(...args));
        gadget.current().instances.receive({ [id]: instance });

        return { created: { id, type } };
      }
    }
  })(deps);
}

/**
 * Wiring processor - creates actual connections from edge data
 */
type WiringProcessorSpec =
  & State<{
    instances: Gadget<TableSpec<string, Gadget<unknown>>>;
    patterns: Gadget<TableSpec<string, Function>>;
    cleanups: Map<string, () => void>;
  }>
  & Input<
    | { wire: Record<string, Edge> }
    | { unwire: Record<string, Edge> }
  >
  & Actions<{
    wire: { id: string; edge: Edge };
    unwire: { id: string };
  }>
  & Effects<{
    wired: { id: string; from: string; to: string };
    unwired: { id: string };
    notFound: { from?: string; to?: string; pattern?: string };
  }>;

function wiringProcessor(deps: {
  instances: Gadget<TableSpec<string, Gadget<unknown>>>;
  patterns: Gadget<TableSpec<string, Function>>;
}) {
  return defGadget<WiringProcessorSpec>({
    dispatch: (_state, input) => {
      if ('wire' in input) {
        // Process first edge
        for (const [id, edge] of Object.entries(input.wire)) {
          return { wire: { id, edge } };
        }
      }
      if ('unwire' in input) {
        // Process first removal
        for (const id of Object.keys(input.unwire)) {
          return { unwire: { id } };
        }
      }
      return null;
    },
    methods: {
      wire: (gadget, { id, edge }) => {
        const instances = gadget.current().instances.current();
        const fromGadget = instances[edge.from];
        const toGadget = instances[edge.to];

        if (!fromGadget) return { notFound: { from: edge.from } };
        if (!toGadget) return { notFound: { to: edge.to } };

        // Determine wiring pattern from edge metadata
        let cleanup: () => void;

        if (edge.transform && typeof edge.transform === 'function') {
          // Use transform pattern if transform function provided
          const field = edge.field || 'changed';
          const relation = transform(fromGadget as any, field, edge.transform as any, toGadget);
          cleanup = relation.cleanup;
        } else if (edge.field) {
          // Use extract pattern for specific field
          const relation = extract(fromGadget as any, edge.field, toGadget);
          cleanup = relation.cleanup;
        } else {
          // Default: extract 'changed' field
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
 * Create a bassline - a specific wiring pattern
 */
export function basslineGadget(config: {
  factories?: Record<string, Function>;
  patterns?: Record<string, Function>;
} = {}) {
  // Create the tables - any gadget could fill these roles
  const definitions = withTaps(lastTable<string, Function>(config.factories || {}));
  const instances = withTaps(lastTable<string, Gadget<unknown>>({}));
  const edges = withTaps(lastTable<string, Edge>({}));
  const patterns = withTaps(lastTable<string, Function>(config.patterns || { extract, transform }));

  // Create the processors
  const factory = withTaps(factoryProcessor({ definitions, instances }));
  const wiring = withTaps(wiringProcessor({ instances, patterns }));

  // Wire the processors to observe table changes
  // This IS the bassline - this specific pattern of connections
  edges.tap(({ added, removed }) => {
    if (added && Object.keys(added).length > 0) {
      wiring.receive({ wire: added });
    }
    if (removed && Object.keys(removed).length > 0) {
      wiring.receive({ unwire: removed });
    }
  });

  // Return the composed system - not a gadget, just the components
  return {
    definitions,
    instances,
    edges,
    patterns,
    factory,
    wiring,

    // Convenience methods for common operations
    create: (id: string, type: string, args: unknown[] = []) => {
      factory.receive({ create: { id, type, args } });
    },
    wire: (id: string, from: string, to: string, metadata: Partial<Edge> = {}) => {
      edges.receive({ [id]: { from, to, ...metadata } });
    },
    disconnect: (id: string) => {
      edges.receive({ [id]: null });
    },
    destroy: (id: string) => {
      instances.receive({ [id]: null });
      // Remove any edges involving this instance
      const currentEdges = edges.current();
      const toRemove: Record<string, null> = {};
      for (const [edgeId, edge] of Object.entries(currentEdges)) {
        if (edge.from === id || edge.to === id) {
          toRemove[edgeId] = null;
        }
      }
      if (Object.keys(toRemove).length > 0) {
        edges.receive(toRemove);
      }
    }
  };
}