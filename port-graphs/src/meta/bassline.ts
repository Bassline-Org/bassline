/**
 * Bassline - A meta-gadget for managing gadget namespaces, instances, and connections
 *
 * A bassline is the "baseline" context that defines:
 * - What gadgets can be created (namespace of factories)
 * - What gadget instances exist (registry)
 * - How gadgets are connected (connections)
 * - What wiring patterns are available (patterns)
 *
 * Basslines are themselves gadgets, so they can be composed, tapped, and wired.
 */

import { defGadget, withTaps, type Gadget, type State, type Input, type Actions, type Effects } from '../core/typed';
import { lastTable, TableSpec } from '../patterns/cells/tables';
import { extract, transform } from '../relations';

/**
 * Information about a connection between gadgets
 */
type ConnectionInfo = {
  from: string;
  to: string;
  pattern: string;
  cleanup: () => void;
};

/**
 * Bassline specification
 */
type BasslineSpec =
  & State<{
    namespace: Gadget<TableSpec<string, Function>>;
    registry: Gadget<TableSpec<string, Gadget<unknown>>>;
    connections: Gadget<TableSpec<string, ConnectionInfo>>;
    patterns: Gadget<TableSpec<string, Function>>;
  }>
  & Input<
    | { create: { id: string; type: string; args: unknown[] } }
    | { wire: { id: string; from: string; to: string; pattern?: string; args?: unknown[] } }
    | { disconnect: string }
    | { registerFactory: { name: string; factory: Function } }
    | { registerPattern: { name: string; pattern: Function } }
    | { destroy: string }
  >
  & Actions<{
    create: { id: string; type: string; args: unknown[] };
    wire: { id: string; from: string; to: string; pattern?: string; args?: unknown[] };
    disconnect: string;
    registerFactory: { name: string; factory: Function };
    registerPattern: { name: string; pattern: Function };
    destroy: string;
  }>
  & Effects<{
    created: { id: string; type: string };
    wired: { id: string; from: string; to: string };
    disconnected: { id: string };
    destroyed: { id: string };
    factoryRegistered: { name: string };
    patternRegistered: { name: string };
    notFound: { type?: string; instance?: string; pattern?: string };
  }>;

/**
 * Create a bassline gadget
 *
 * @param config Initial configuration with factories and patterns
 * @returns A bassline gadget that manages gadget creation and wiring
 *
 * @example
 * ```typescript
 * const bassline = withTaps(basslineGadget({
 *   factories: { slider: sliderGadget, max: maxCell },
 *   patterns: { wire: extract }
 * }));
 *
 * bassline.receive({ create: { id: 'input', type: 'slider', args: [50, 0, 100] } });
 * bassline.receive({ create: { id: 'output', type: 'max', args: [0] } });
 * bassline.receive({ wire: { id: 'link', from: 'input', to: 'output' } });
 * ```
 */
export function basslineGadget(config: {
  factories?: Record<string, Function>;
  patterns?: Record<string, Function>;
} = {}) {
  // Create the table gadgets that store our state
  const namespace = withTaps(lastTable(config.factories || {}));
  const registry = withTaps(lastTable<string, Gadget<unknown>>({}));
  const connections = withTaps(lastTable<string, ConnectionInfo>({}));
  const patterns = withTaps(lastTable(config.patterns || {
    extract: extract,
    transform: transform
  }));

  return defGadget<BasslineSpec>({
    dispatch: (state, input) => {
      if ('create' in input) return { create: input.create };
      if ('wire' in input) return { wire: input.wire };
      if ('disconnect' in input) return { disconnect: input.disconnect };
      if ('registerFactory' in input) return { registerFactory: input.registerFactory };
      if ('registerPattern' in input) return { registerPattern: input.registerPattern };
      if ('destroy' in input) return { destroy: input.destroy };
      return null;
    },
    methods: {
      create: (gadget, { id, type, args }) => {
        const factories = gadget.current().namespace.current();
        const factory = factories[type];
        if (!factory) return { notFound: { type } };

        // Create the gadget instance with taps
        const instance = withTaps(factory(...args));

        // Send declarative command to registry
        const currentRegistry = gadget.current().registry.current();
        gadget.current().registry.receive({
          ...currentRegistry,
          [id]: instance
        });

        return { created: { id, type } };
      },

      wire: (gadget, { id, from, to, pattern = 'extract', args = [] }) => {
        const instances = gadget.current().registry.current();
        const fromGadget = instances[from];
        const toGadget = instances[to];
        const patternFn = gadget.current().patterns.current()[pattern];

        if (!fromGadget) return { notFound: { instance: from } };
        if (!toGadget) return { notFound: { instance: to } };
        if (!patternFn) return { notFound: { pattern } };

        // Create the connection using the pattern
        const relation = patternFn(fromGadget, ...args, toGadget);

        // Send declarative command to connections table
        const currentConnections = gadget.current().connections.current();
        gadget.current().connections.receive({
          ...currentConnections,
          [id]: { from, to, pattern, cleanup: relation.cleanup }
        });

        return { wired: { id, from, to } };
      },

      disconnect: (gadget, id) => {
        const connection = gadget.current().connections.current()[id];
        if (!connection) return { notFound: { instance: id } };

        // Clean up the connection
        connection.cleanup();

        // Send declarative command to remove connection by sending null
        gadget.current().connections.receive({ [id]: null });

        return { disconnected: { id } };
      },

      registerFactory: (gadget, { name, factory }) => {
        // Send declarative command to namespace
        const current = gadget.current().namespace.current();
        gadget.current().namespace.receive({
          ...current,
          [name]: factory
        });

        return { factoryRegistered: { name } };
      },

      registerPattern: (gadget, { name, pattern }) => {
        // Send declarative command to patterns table
        const current = gadget.current().patterns.current();
        gadget.current().patterns.receive({
          ...current,
          [name]: pattern
        });

        return { patternRegistered: { name } };
      },

      destroy: (gadget, id) => {
        const instances = gadget.current().registry.current();
        if (!instances[id]) return { notFound: { instance: id } };

        // First disconnect any connections involving this gadget
        const connections = gadget.current().connections.current();
        const connectionsToRemove: Partial<Record<string, null>> = {};

        Object.entries(connections).forEach(([connId, conn]) => {
          if (conn.from === id || conn.to === id) {
            conn.cleanup();
            connectionsToRemove[connId] = null;
          }
        });

        // Remove from registry by sending null for the key
        gadget.current().registry.receive({ [id]: null });

        // Remove related connections by sending null for their keys
        if (Object.keys(connectionsToRemove).length > 0) {
          gadget.current().connections.receive(connectionsToRemove);
        }

        return { destroyed: { id } };
      }
    }
  })({ namespace, registry, connections, patterns });
}