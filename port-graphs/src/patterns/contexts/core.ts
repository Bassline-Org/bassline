import { createGadget, Gadget } from "../../core";
import { changed, noop } from "../../effects";
import { Tappable } from "../../semantics";

/**
 * Core context patterns for routing effects between gadgets
 *
 * All contexts understand lifecycle effects:
 * - { mount: { source } } - Tap into a source gadget
 * - { unmount: { source } } - Disconnect from source
 * - { configure: { ...params } } - Update context parameters
 * - { data: ... } - Regular data flow
 */

type LifecycleEffect<Config = any> =
  | { mount: { source: Gadget & Tappable } }
  | { unmount: { source: Gadget } }
  | { configure: Config }
  | { data: any };

/**
 * Pass context - just passes effects through (identity)
 */
export const passContext = () =>
  createGadget<{ cleanup?: () => void }, LifecycleEffect>(
    (_state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('data' in incoming) return { action: 'pass', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = (source as any).tap((effect: any) => gadget.emit(effect));
        gadget.update({ cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        gadget.current().cleanup?.();
        gadget.update({});
        return noop();
      },
      'pass': (_gadget, data) => changed(data as NonNullable<any>)
    }
  );

/**
 * Filter context - only passes effects matching predicate
 */
export const filterContext = <T>(predicate: (effect: T) => boolean) =>
  createGadget<{ cleanup?: () => void; predicate: (effect: T) => boolean }, LifecycleEffect<{ predicate: (effect: T) => boolean }>>(
    (_state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('configure' in incoming) return { action: 'configure', context: incoming.configure };
      if ('data' in incoming) return { action: 'filter', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = source.tap((effect: any) =>
          gadget.receive({ data: effect })
        );
        gadget.update({ ...gadget.current(), cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        gadget.current().cleanup?.();
        gadget.update({ predicate: gadget.current().predicate });
        return noop();
      },
      'configure': (gadget, config) => {
        gadget.update({ ...gadget.current(), ...config });
        return noop();
      },
      'filter': (gadget, data) => {
        if (gadget.current().predicate(data)) {
          return changed(data as NonNullable<T>);
        }
        return noop();
      }
    }
  )({ predicate });

/**
 * Transform context - transforms effects before passing
 */
export const transformContext = <In, Out>(transformer: (input: In) => Out) =>
  createGadget<{ cleanup?: () => void; transformer: (input: In) => Out }, LifecycleEffect<{ transformer: (input: In) => Out }>>(
    (_state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('configure' in incoming) return { action: 'configure', context: incoming.configure };
      if ('data' in incoming) return { action: 'transform', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = source.tap((effect: any) =>
          gadget.receive({ data: effect })
        );
        gadget.update({ ...gadget.current(), cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        gadget.current().cleanup?.();
        gadget.update({ transformer: gadget.current().transformer });
        return noop();
      },
      'configure': (gadget, config) => {
        gadget.update({ ...gadget.current(), ...config });
        return noop();
      },
      'transform': (gadget, data) => {
        const transformed = gadget.current().transformer(data);
        return changed(transformed as NonNullable<Out>);
      }
    }
  )({ transformer });

/**
 * Switch context - routes based on effect properties
 */
export const switchContext = <T extends { type: string }>(
  routes: Record<string, (data: T) => any>
) =>
  createGadget<{ cleanup?: () => void; routes: Record<string, (data: T) => any> }, LifecycleEffect<{ routes: Record<string, (data: T) => any> }>>(
    (_state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('configure' in incoming) return { action: 'configure', context: incoming.configure };
      if ('data' in incoming) return { action: 'switch', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = source.tap((effect: any) =>
          gadget.receive({ data: effect })
        );
        gadget.update({ ...gadget.current(), cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        gadget.current().cleanup?.();
        gadget.update({ routes: gadget.current().routes });
        return noop();
      },
      'configure': (gadget, config) => {
        gadget.update({ ...gadget.current(), ...config });
        return noop();
      },
      'switch': (gadget, data: T) => {
        const route = gadget.current().routes[data.type] || gadget.current().routes['default'];
        if (route) {
          return changed(route(data));
        }
        return noop();
      }
    }
  )({ routes });

/**
 * Batch context - collects effects and emits in batches
 */
export const batchContext = <T>(size: number, timeout?: number) =>
  createGadget<{
    cleanup?: () => void;
    batch: T[];
    size: number;
    timeout: number | undefined;
    timer?: NodeJS.Timeout;
  }, LifecycleEffect<{ size?: number; timeout: number | undefined }>>(
    (state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('configure' in incoming) return { action: 'configure', context: incoming.configure };
      if ('data' in incoming) return { action: 'collect', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = source.tap((effect: any) =>
          gadget.receive({ data: effect })
        );
        gadget.update({ ...gadget.current(), cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        const state = gadget.current();
        state.cleanup?.();
        if (state.timer) clearTimeout(state.timer);
        const newState: any = { batch: [], size: state.size };
        if (state.timeout !== undefined) newState.timeout = state.timeout;
        gadget.update(newState);
        return noop();
      },
      'configure': (gadget, config) => {
        gadget.update({ ...gadget.current(), ...config });
        return noop();
      },
      'collect': (gadget, data: T) => {
        const state = gadget.current();
        const batch = [...state.batch, data];

        // Clear existing timer
        if (state.timer) clearTimeout(state.timer);

        if (batch.length >= state.size) {
          // Batch is full, emit immediately
          const newState = { ...state, batch: [] };
          delete newState.timer;
          gadget.update(newState);
          return changed(batch as NonNullable<T[]>);
        } else {
          // Set timeout if configured
          let timer: NodeJS.Timeout | undefined;
          if (state.timeout) {
            timer = setTimeout(() => {
              const currentBatch = gadget.current().batch;
              if (currentBatch.length > 0) {
                const newState = { ...gadget.current(), batch: [] };
                delete newState.timer;
                gadget.update(newState);
                gadget.emit(changed(currentBatch as NonNullable<T[]>));
              }
            }, state.timeout);
          }
          const newState = { ...state, batch };
          if (timer) newState.timer = timer;
          gadget.update(newState);
          return noop();
        }
      }
    }
  )(((): any => {
    const initial: any = { batch: [], size };
    if (timeout !== undefined) initial.timeout = timeout;
    return initial;
  })());

/**
 * Throttle context - rate limits effect flow
 */
export const throttleContext = <T>(intervalMs: number) =>
  createGadget<{
    cleanup?: () => void;
    lastEmit: number;
    intervalMs: number;
    pending?: T;
    timer?: NodeJS.Timeout;
  }, LifecycleEffect<{ intervalMs?: number }>>(
    (_state, incoming) => {
      if ('mount' in incoming) return { action: 'mount', context: incoming.mount };
      if ('unmount' in incoming) return { action: 'unmount' };
      if ('configure' in incoming) return { action: 'configure', context: incoming.configure };
      if ('data' in incoming) return { action: 'throttle', context: incoming.data };
      return null;
    },
    {
      'mount': (gadget, { source }) => {
        const cleanup = source.tap((effect: any) =>
          gadget.receive({ data: effect })
        );
        gadget.update({ ...gadget.current(), cleanup });
        return noop();
      },
      'unmount': (gadget) => {
        const state = gadget.current();
        state.cleanup?.();
        if (state.timer) clearTimeout(state.timer);
        gadget.update({ lastEmit: 0, intervalMs: state.intervalMs });
        return noop();
      },
      'configure': (gadget, config) => {
        gadget.update({ ...gadget.current(), ...config });
        return noop();
      },
      'throttle': (gadget, data: T) => {
        const state = gadget.current();
        const now = Date.now();
        const timeSinceLastEmit = now - state.lastEmit;

        if (timeSinceLastEmit >= state.intervalMs) {
          // Enough time has passed, emit immediately
          const newState: any = { ...state, lastEmit: now };
          delete newState.pending;
          gadget.update(newState);
          return changed(data as NonNullable<T>);
        } else {
          // Too soon, schedule for later
          if (state.timer) clearTimeout(state.timer);

          const timer = setTimeout(() => {
            const pending = gadget.current().pending;
            if (pending !== undefined) {
              const newState: any = { ...gadget.current(), lastEmit: Date.now() };
              delete newState.pending;
              delete newState.timer;
              gadget.update(newState);
              gadget.emit(changed(pending as NonNullable<T>));
            }
          }, state.intervalMs - timeSinceLastEmit);

          gadget.update({ ...state, pending: data, timer });
          return noop();
        }
      }
    }
  )({ lastEmit: 0, intervalMs });