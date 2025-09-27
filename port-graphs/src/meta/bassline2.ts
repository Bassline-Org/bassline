/**
 * Bassline2 - A composition of independent gadgets that manage gadget systems
 *
 * This is a refactored version where the bassline is not a monolithic gadget,
 * but rather a specific wiring pattern connecting independent components:
 * - Tables for data storage
 * - Processors for transformations
 * - Commander for routing
 */

import { defGadget, withTaps, type Gadget, type State, type Input, type Actions, type Effects, type Tappable } from '../core/typed';
import { lastTable, TableSpec } from '../patterns/cells/tables';
import { extract, transform } from '../relations';

/**
 * Edge represents a connection in the topology
 */
type Edge = {
  from: string;
  to: string;
  pattern: string;
  args?: unknown[];
};

/**
 * Commander routes commands to appropriate tables
 */
type CommanderSpec =
  & State<{
    namespace: Gadget<TableSpec<string, Function>>;
    registry: Gadget<TableSpec<string, Gadget<unknown>>>;
    topology: Gadget<TableSpec<string, Edge>>;
    patterns: Gadget<TableSpec<string, Function>>;
  }>
  & Input<
    | { setFactory: { name: string; factory: Function } }
    | { removeFactory: string }
    | { setPattern: { name: string; pattern: Function } }
    | { removePattern: string }
    | { setInstance: { id: string; instance: Gadget<unknown> } }
    | { removeInstance: string }
    | { setEdge: { id: string; edge: Edge } }
    | { removeEdge: string }
  >
  & Actions<{
    setFactory: { name: string; factory: Function };
    removeFactory: string;
    setPattern: { name: string; pattern: Function };
    removePattern: string;
    setInstance: { id: string; instance: Gadget<unknown> };
    removeInstance: string;
    setEdge: { id: string; edge: Edge };
    removeEdge: string;
  }>
  & Effects<{
    routed: { table: string; operation: string };
  }>;

function commanderGadget() {
  return defGadget<CommanderSpec>({
    dispatch: (state, input) => {
      if ('setFactory' in input) return { setFactory: input.setFactory };
      if ('removeFactory' in input) return { removeFactory: input.removeFactory };
      if ('setPattern' in input) return { setPattern: input.setPattern };
      if ('removePattern' in input) return { removePattern: input.removePattern };
      if ('setInstance' in input) return { setInstance: input.setInstance };
      if ('removeInstance' in input) return { removeInstance: input.removeInstance };
      if ('setEdge' in input) return { setEdge: input.setEdge };
      if ('removeEdge' in input) return { removeEdge: input.removeEdge };
      return null;
    },
    methods: {
      setFactory: (gadget, { name, factory }) => {
        gadget.current().namespace.receive({ [name]: factory });
        return { routed: { table: 'namespace', operation: 'set' } };
      },
      removeFactory: (gadget, name) => {
        gadget.current().namespace.receive({ [name]: null });
        return { routed: { table: 'namespace', operation: 'remove' } };
      },
      setPattern: (gadget, { name, pattern }) => {
        gadget.current().patterns.receive({ [name]: pattern });
        return { routed: { table: 'patterns', operation: 'set' } };
      },
      removePattern: (gadget, name) => {
        gadget.current().patterns.receive({ [name]: null });
        return { routed: { table: 'patterns', operation: 'remove' } };
      },
      setInstance: (gadget, { id, instance }) => {
        gadget.current().registry.receive({ [id]: instance });
        return { routed: { table: 'registry', operation: 'set' } };
      },
      removeInstance: (gadget, id) => {
        gadget.current().registry.receive({ [id]: null });
        return { routed: { table: 'registry', operation: 'remove' } };
      },
      setEdge: (gadget, { id, edge }) => {
        gadget.current().topology.receive({ [id]: edge });
        return { routed: { table: 'topology', operation: 'set' } };
      },
      removeEdge: (gadget, id) => {
        gadget.current().topology.receive({ [id]: null });
        return { routed: { table: 'topology', operation: 'remove' } };
      }
    }
  });
}

/**
 * FactoryProcessor creates instances from factories
 */
type FactoryProcessorSpec =
  & State<{
    namespace: Gadget<TableSpec<string, Function>>;
    commander: Gadget<CommanderSpec> & Tappable<CommanderSpec>;
  }>
  & Input<{ create: { id: string; type: string; args: unknown[] } }>
  & Actions<{ create: { id: string; type: string; args: unknown[] } }>
  & Effects<{
    created: { id: string; type: string };
    notFound: { type: string };
  }>;

function factoryProcessorGadget() {
  return defGadget<FactoryProcessorSpec>({
    dispatch: (state, input) => {
      if ('create' in input) return { create: input.create };
      return null;
    },
    methods: {
      create: (gadget, { id, type, args }) => {
        const factories = gadget.current().namespace.current();
        const factory = factories[type];

        if (!factory) {
          return { notFound: { type } };
        }

        const instance = withTaps(factory(...args));
        gadget.current().commander.receive({ setInstance: { id, instance } });

        return { created: { id, type } };
      }
    }
  });
}

/**
 * WiringProcessor creates actual connections when topology changes
 */
type WiringProcessorSpec =
  & State<{
    registry: Gadget<TableSpec<string, Gadget<unknown>>>;
    patterns: Gadget<TableSpec<string, Function>>;
    cleanups: Gadget<TableSpec<string, () => void>>;
  }>
  & Input<
    | { added: Record<string, Edge> }
    | { removed: Record<string, Edge> }
  >
  & Actions<{
    wire: { id: string; edge: Edge };
    unwire: { id: string };
  }>
  & Effects<{
    wired: { id: string; from: string; to: string };
    unwired: { id: string };
    notFound: { instance?: string; pattern?: string };
  }>;

function wiringProcessorGadget() {
  return defGadget<WiringProcessorSpec>({
    dispatch: (_state, input) => {
      if ('added' in input) {
        for (const [id, edge] of Object.entries(input.added)) {
          return { wire: { id, edge } };
        }
      }
      if ('removed' in input) {
        for (const id of Object.keys(input.removed)) {
          return { unwire: { id } };
        }
      }
      return null;
    },
    methods: {
      wire: (gadget, { id, edge }) => {
        const instances = gadget.current().registry.current();
        const patterns = gadget.current().patterns.current();

        const fromGadget = instances[edge.from];
        const toGadget = instances[edge.to];
        const patternFn = patterns[edge.pattern];

        if (!fromGadget) return { notFound: { instance: edge.from } };
        if (!toGadget) return { notFound: { instance: edge.to } };
        if (!patternFn) return { notFound: { pattern: edge.pattern } };

        const relation = patternFn(fromGadget, ...(edge.args || []), toGadget);

        gadget.current().cleanups.receive({ [id]: relation.cleanup });

        return { wired: { id, from: edge.from, to: edge.to } };
      },
      unwire: (gadget, { id }) => {
        const cleanups = gadget.current().cleanups.current();
        const cleanup = cleanups[id];

        if (cleanup) {
          cleanup();
          gadget.current().cleanups.receive({ [id]: null });
        }

        return { unwired: { id } };
      }
    }
  });
}

/**
 * Create a bassline by wiring together the components
 */
export function basslineGadget(config: {
  factories?: Record<string, Function>;
  patterns?: Record<string, Function>;
} = {}) {
  // Create the data tables
  const namespace = withTaps(lastTable<string, Function>(config.factories || {}));
  const registry = withTaps(lastTable<string, Gadget<unknown>>({}));
  const topology = withTaps(lastTable<string, Edge>({}));
  const patterns = withTaps(lastTable<string, Function>(config.patterns || {
    extract,
    transform
  }));
  const cleanups = withTaps(lastTable<string, () => void>({}));

  // Create the processors
  const commander = withTaps(commanderGadget()({ namespace, registry, topology, patterns }));
  const factory = withTaps(factoryProcessorGadget()({ namespace, commander }));
  const wiring = withTaps(wiringProcessorGadget()({ registry, patterns, cleanups }));

  // Wire the processors to observe table changes
  topology.tap(({ added, removed }) => {
    if (added && Object.keys(added).length > 0) {
      wiring.receive({ added });
    }
    if (removed && Object.keys(removed).length > 0) {
      wiring.receive({ removed });
    }
  });

  // Create a facade object that routes commands
  const bassline = {
    receive: (input: any) => {
      if ('create' in input) {
        factory.receive(input);
      } else if ('wire' in input) {
        const { id, from, to, pattern = 'extract', args = [] } = input.wire;
        commander.receive({ setEdge: { id, edge: { from, to, pattern, args } } });
      } else if ('disconnect' in input) {
        commander.receive({ removeEdge: input.disconnect });
      } else if ('registerFactory' in input) {
        commander.receive({ setFactory: input.registerFactory });
      } else if ('registerPattern' in input) {
        commander.receive({ setPattern: input.registerPattern });
      } else if ('destroy' in input) {
        const id = input.destroy;
        commander.receive({ removeInstance: id });

        // Also remove any edges involving this instance
        const edges = topology.current();
        for (const [edgeId, edge] of Object.entries(edges)) {
          if ((edge as Edge).from === id || (edge as Edge).to === id) {
            commander.receive({ removeEdge: edgeId });
          }
        }
      }
    },
    current: () => ({
      namespace,
      registry,
      topology,
      patterns
    })
  };

  return withTaps(bassline as any);
}