/**
 * Bassline - A gadget that builds relations between gadgets
 *
 * A bassline IS a gadget. It takes declarative descriptions of relations
 * and builds actual connections using our existing primitives (extract, transform, etc).
 *
 * Internally it can compose other gadgets (tables, processors, etc) but externally
 * it presents a clean gadget interface. Different basslines can have different
 * internal semantics while maintaining the same interface.
 */

import { defGadget, withTaps, type Gadget, type State, type Input, type Actions, type Effects } from '../core/typed';
import { lastTable } from '../patterns/cells/tables';
import { extract, transform } from '../relations';

/**
 * The bassline gadget specification
 * This defines what a bassline can receive and emit
 */
export type BasslineSpec =
  & State<{
    // Internal state - hidden from users
    definitions: Map<string, Function>;
    instances: Map<string, Gadget<unknown>>;
    edges: Map<string, { from: string; to: string; metadata?: any }>;
    relations: Map<string, { cleanup: () => void }>;
  }>
  & Input<
    | { define: { name: string; factory: Function } }
    | { create: { id: string; type: string; args?: unknown[] } }
    | { wire: { id: string; from: string; to: string; field?: string; transform?: Function;[key: string]: any } }
    | { unwire: string }
    | { destroy: string }
  >
  & Actions<{
    define: { name: string; factory: Function };
    create: { id: string; type: string; args?: unknown[] };
    wire: { id: string; from: string; to: string; field?: string; transform?: Function;[key: string]: any };
    unwire: string;
    destroy: string;
  }>
  & Effects<{
    defined: { name: string };
    created: { id: string; type: string };
    wired: { id: string; from: string; to: string };
    unwired: { id: string };
    destroyed: { id: string };
    notFound: { type?: string; instance?: string };
  }>;

/**
 * Create a bassline gadget
 *
 * A bassline is a gadget that manages relations between other gadgets.
 * It can be composed, tapped, and wired just like any other gadget.
 *
 * @example
 * ```typescript
 * const bassline = withTaps(basslineGadget());
 *
 * // Define factories
 * bassline.receive({ define: { name: 'max', factory: maxCell } });
 *
 * // Create instances
 * bassline.receive({ create: { id: 'sensor', type: 'max', args: [0] } });
 *
 * // Wire them together
 * bassline.receive({ wire: { id: 'link', from: 'sensor', to: 'display' } });
 * ```
 */
export function basslineGadget(initialDefinitions: Record<string, Function> = {}) {
  return defGadget<BasslineSpec>({
    dispatch: (state, input) => {
      if ('define' in input) return { define: input.define };
      if ('create' in input) return { create: input.create };
      if ('wire' in input) return { wire: input.wire };
      if ('unwire' in input) return { unwire: input.unwire };
      if ('destroy' in input) return { destroy: input.destroy };
      return null;
    },
    methods: {
      define: (gadget, { name, factory }) => {
        gadget.current().definitions.set(name, factory);
        return { defined: { name } };
      },

      create: (gadget, { id, type, args = [] }) => {
        const factory = gadget.current().definitions.get(type);
        if (!factory) {
          return { notFound: { type } };
        }

        const instance = withTaps(factory(...args));
        gadget.current().instances.set(id, instance);

        return { created: { id, type } };
      },

      wire: (gadget, wireCmd) => {
        const { id, from, to, ...metadata } = wireCmd;
        const instances = gadget.current().instances;
        const fromGadget = instances.get(from);
        const toGadget = instances.get(to);

        if (!fromGadget) return { notFound: { instance: from } };
        if (!toGadget) return { notFound: { instance: to } };

        // Store the edge description
        gadget.current().edges.set(id, { from, to, metadata });

        // Build the actual relation using our primitives
        let relation;
        if (metadata.transform && typeof metadata.transform === 'function') {
          const field = metadata.field || 'changed';
          relation = transform(fromGadget as any, field, metadata.transform, toGadget);
        } else if (metadata.field) {
          relation = extract(fromGadget as any, metadata.field, toGadget);
        } else {
          relation = extract(fromGadget as any, 'changed', toGadget);
        }

        gadget.current().relations.set(id, relation);
        return { wired: { id, from, to } };
      },

      unwire: (gadget, id) => {
        const relation = gadget.current().relations.get(id);
        if (relation) {
          relation.cleanup();
          gadget.current().relations.delete(id);
          gadget.current().edges.delete(id);
        }
        return { unwired: { id } };
      },

      destroy: (gadget, id) => {
        const instances = gadget.current().instances;
        if (!instances.has(id)) {
          return { notFound: { instance: id } };
        }

        // Remove the instance
        instances.delete(id);

        // Clean up any edges involving this instance
        const edges = gadget.current().edges;
        const relations = gadget.current().relations;
        const toRemove: string[] = [];

        edges.forEach((edge, edgeId) => {
          if (edge.from === id || edge.to === id) {
            toRemove.push(edgeId);
          }
        });

        toRemove.forEach(edgeId => {
          const relation = relations.get(edgeId);
          if (relation) {
            relation.cleanup();
            relations.delete(edgeId);
          }
          edges.delete(edgeId);
        });

        return { destroyed: { id } };
      }
    }
  })({
    definitions: new Map(Object.entries(initialDefinitions)),
    instances: new Map(),
    edges: new Map(),
    relations: new Map()
  });
}

/**
 * Create a bassline that uses table gadgets internally
 * This is a different "flavor" that shows how internal implementation can vary
 */
export function tableBasslineGadget(config: {
  factories?: Record<string, Function>;
  patterns?: Record<string, Function>;
} = {}) {
  // Internal gadgets
  const definitions = withTaps(lastTable<string, Function>(config.factories || {}));
  const instances = withTaps(lastTable<string, Gadget<unknown>>({}));
  const edges = withTaps(lastTable<string, any>({}));

  // The bassline gadget that orchestrates the tables
  const bassline = basslineGadget();

  // Wire the internal tables to the bassline
  // When definitions change, update the bassline
  definitions.tap(({ added, removed }) => {
    if (added) {
      Object.entries(added).forEach(([name, factory]) => {
        bassline.receive({ define: { name, factory } });
      });
    }
  });

  // This bassline variant stores state in tables but presents the same interface
  return withTaps(defGadget<BasslineSpec>({
    dispatch: (state, input) => {
      // Forward to the internal bassline
      bassline.receive(input as any);

      // Also update tables for persistence/observability
      if ('define' in input) {
        definitions.receive({ [input.define.name]: input.define.factory });
      }
      if ('create' in input) {
        const instance = bassline.current().instances.get(input.create.id);
        if (instance) {
          instances.receive({ [input.create.id]: instance });
        }
      }
      if ('wire' in input) {
        edges.receive({ [input.wire.id]: input.wire });
      }
      if ('unwire' in input) {
        edges.receive({ [input.unwire]: null });
      }
      if ('destroy' in input) {
        instances.receive({ [input.destroy]: null });
      }

      return null; // Actions handled by internal bassline
    },
    methods: {}
  })(bassline.current()));
}

/**
 * Helper to get a gadget instance from a bassline
 */
export function getInstance(bassline: Gadget<BasslineSpec>, id: string): Gadget<unknown> | undefined {
  return bassline.current().instances.get(id);
}