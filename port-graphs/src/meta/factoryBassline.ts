/**
 * Factory Bassline - A gadget that manages types, instances, and connections
 *
 * This bassline treats everything as data, including errors. Errors are not failures
 * but partial information that other gadgets can use to provide missing capabilities.
 */

import { type State, type Input, type Actions, type Effects, type Gadget, defGadget, withTaps, type Tappable } from '../core/typed';
import { extract, transform } from '../relations';

export type FactoryBasslineSpec =
  & State<{
    types: Record<string, Function>;
    instances: Record<string, Gadget<any>>;
    connections: Record<string, { cleanup: () => void; data: any }>;
    patterns: Record<string, (from: any, to: any, config?: any) => { cleanup: () => void }>;
  }>
  & Input<
    | { defineType: { name: string; factory: Function } }
    | { spawn: { name: string; type: string; args?: any[] } }
    | { connect: { id: string; from: string; to: string; pattern?: string; config?: any } }
    | { definePattern: { name: string; pattern: (from: any, to: any, config?: any) => { cleanup: () => void } } }
    | { disconnect: string }
    | { destroy: string }
  >
  & Actions<{
    defineType: { name: string; factory: Function };
    spawn: { name: string; type: string; args?: any[] };
    connect: { id: string; from: string; to: string; pattern?: string; config?: any };
    definePattern: { name: string; pattern: Function };
    disconnect: string;
    destroy: string;
  }>
  & Effects<{
    // Success effects
    typeAdded: { name: string; factory: Function };
    spawned: { name: string; type: string; instance: Gadget<any> };
    connected: { id: string; from: string; to: string; pattern?: string };
    patternAdded: { name: string };
    disconnected: string;
    destroyed: string;

    // Error effects - partial information for other gadgets
    unknownType: { type: string; availableTypes: string[] };
    unknownInstance: { instance: string; availableInstances: string[]; context: 'connection' | 'destroy' };
    unknownPattern: { pattern: string; availablePatterns: string[] };
    spawnFailed: { name: string; type: string; error: string };
    connectionFailed: { id: string; from: string; to: string; reason: string };
    alreadyExists: { name: string; kind: 'type' | 'instance' | 'connection' | 'pattern' };
  }>;

// Built-in connection patterns
const builtInPatterns = {
  extract: (from: Gadget<any> & Tappable<any>, to: Gadget<any>, config?: { field?: string }) => {
    const field = config?.field || 'changed';
    return extract(from, field, to);
  },

  transform: (from: Gadget<any> & Tappable<any>, to: Gadget<any>, config?: { field?: string; fn?: Function }) => {
    const field = config?.field || 'changed';
    const fn = config?.fn || ((x: any) => x);
    return transform(from, field, fn, to);
  },

  forward: (from: Gadget<any> & Tappable<any>, to: Gadget<any>) => {
    const cleanup = from.tap(effect => {
      to.receive(effect);
    });
    return { cleanup };
  }
};

export function factoryBassline(initialTypes: Record<string, Function> = {}) {
  return defGadget<FactoryBasslineSpec>({
    dispatch: (state, input) => {
      if ('defineType' in input) return { defineType: input.defineType };
      if ('spawn' in input) return { spawn: input.spawn };
      if ('connect' in input) return { connect: input.connect };
      if ('definePattern' in input) return { definePattern: input.definePattern };
      if ('disconnect' in input) return { disconnect: input.disconnect };
      if ('destroy' in input) return { destroy: input.destroy };
      return null;
    },

    methods: {
      defineType: (gadget, { name, factory }) => {
        const state = gadget.current();
        if (state.types[name]) {
          return { alreadyExists: { name, kind: 'type' } };
        }

        state.types[name] = factory;
        gadget.update(state);
        return { typeAdded: { name, factory } };
      },

      spawn: (gadget, { name, type, args = [] }) => {
        const state = gadget.current();

        if (state.instances[name]) {
          return { alreadyExists: { name, kind: 'instance' } };
        }

        const factory = state.types[type];
        if (!factory) {
          return { unknownType: { type, availableTypes: Object.keys(state.types) } };
        }

        try {
          const instance = withTaps(factory(...args));
          state.instances[name] = instance;
          gadget.update(state);
          return { spawned: { name, type, instance } };
        } catch (error) {
          return { spawnFailed: { name, type, error: String(error) } };
        }
      },

      connect: (gadget, { id, from, to, pattern = 'extract', config }) => {
        const state = gadget.current();

        if (state.connections[id]) {
          return { alreadyExists: { name: id, kind: 'connection' } };
        }

        const fromGadget = state.instances[from];
        const toGadget = state.instances[to];

        if (!fromGadget) {
          return { unknownInstance: { instance: from, availableInstances: Object.keys(state.instances), context: 'connection' } };
        }
        if (!toGadget) {
          return { unknownInstance: { instance: to, availableInstances: Object.keys(state.instances), context: 'connection' } };
        }

        const patternFn = state.patterns[pattern] || builtInPatterns[pattern as keyof typeof builtInPatterns];
        if (!patternFn) {
          return { unknownPattern: { pattern, availablePatterns: [...Object.keys(state.patterns), ...Object.keys(builtInPatterns)] } };
        }

        try {
          // Ensure fromGadget has tap method (is Tappable)
          if (!('tap' in fromGadget)) {
            return { connectionFailed: { id, from, to, reason: 'Source gadget is not tappable' } };
          }
          const connection = patternFn(fromGadget as any, toGadget, config);
          state.connections[id] = { cleanup: connection.cleanup, data: { from, to, pattern, config } };
          gadget.update(state);
          return { connected: { id, from, to, pattern } };
        } catch (error) {
          return { connectionFailed: { id, from, to, reason: String(error) } };
        }
      },

      definePattern: (gadget, { name, pattern }) => {
        const state = gadget.current();
        if (state.patterns[name]) {
          return { alreadyExists: { name, kind: 'pattern' } };
        }

        state.patterns[name] = pattern as (from: any, to: any, config?: any) => { cleanup: () => void };
        gadget.update(state);
        return { patternAdded: { name } };
      },

      disconnect: (gadget, id) => {
        const state = gadget.current();
        const connection = state.connections[id];

        if (connection) {
          connection.cleanup();
          delete state.connections[id];
          gadget.update(state);
        }

        return { disconnected: id };
      },

      destroy: (gadget, name) => {
        const state = gadget.current();

        if (!state.instances[name]) {
          return { unknownInstance: { instance: name, availableInstances: Object.keys(state.instances), context: 'destroy' } };
        }

        // Clean up any connections involving this instance
        for (const [id, connection] of Object.entries(state.connections)) {
          if (connection.data.from === name || connection.data.to === name) {
            connection.cleanup();
            delete state.connections[id];
          }
        }

        delete state.instances[name];
        gadget.update(state);
        return { destroyed: name };
      }
    }
  })({
    types: { ...initialTypes },
    instances: {},
    connections: {},
    patterns: {}
  });
}