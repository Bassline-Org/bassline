import { Gadget } from "../core";
import { wires } from "../semantics/manualWires";

/**
 * Gadget composition utilities for building complex data flows
 */

/**
 * Pipeline - Chain gadgets where output flows to input sequentially
 */
export function pipeline<A, B, C>(
  first: Gadget<A, A, any>,
  second: Gadget<B, A, any>
): Gadget<B, A, any> {
  // Wire first's output to second's input
  wires.directed(first, second);

  // Return a composite gadget that receives into first and exposes second's state
  return {
    current: () => second.current(),
    update: (state: B) => second.update(state),
    receive: (data: A) => first.receive(data),
    emit: (effect: any) => second.emit(effect)
  };
}

/**
 * Parallel - Run multiple gadgets on the same input
 */
export function parallel<State, Incoming>(
  ...gadgets: Gadget<State, Incoming, any>[]
): Gadget<State[], Incoming, any[]> {
  let states: State[] = gadgets.map(g => g.current());

  return {
    current: () => states,
    update: (newStates: State[]) => {
      states = newStates;
      gadgets.forEach((g, i) => g.update(newStates[i]));
    },
    receive: (data: Incoming) => {
      gadgets.forEach(g => g.receive(data));
      states = gadgets.map(g => g.current());
    },
    emit: (effects: any[]) => {
      gadgets.forEach((g, i) => g.emit(effects[i]));
    }
  };
}

/**
 * Fork - Split data to different gadgets based on a predicate
 */
export function fork<Incoming>(
  predicate: (data: Incoming) => string,
  branches: Record<string, Gadget<any, Incoming, any>>
): Gadget<Record<string, any>, Incoming, any> {
  const states: Record<string, any> = {};

  // Initialize states
  Object.entries(branches).forEach(([key, gadget]) => {
    states[key] = gadget.current();
  });

  return {
    current: () => states,
    update: (newStates: Record<string, any>) => {
      Object.entries(newStates).forEach(([key, state]) => {
        if (branches[key]) {
          branches[key].update(state);
          states[key] = state;
        }
      });
    },
    receive: (data: Incoming) => {
      const branch = predicate(data);
      if (branches[branch]) {
        branches[branch].receive(data);
        states[branch] = branches[branch].current();
      }
    },
    emit: (effect: any) => {
      // Broadcast to all branches
      Object.values(branches).forEach(g => g.emit(effect));
    }
  };
}

/**
 * Merge - Combine outputs from multiple gadgets
 */
export function merge<State>(
  combiner: (states: State[]) => State,
  ...gadgets: Gadget<State, any, any>[]
): Gadget<State, number, any> {
  let combined = combiner(gadgets.map(g => g.current()));

  // Wire all gadgets to update combined state
  gadgets.forEach((gadget, index) => {
    const originalEmit = gadget.emit;
    gadget.emit = (effect) => {
      originalEmit.call(gadget, effect);
      // Recombine when any gadget changes
      combined = combiner(gadgets.map(g => g.current()));
    };
  });

  return {
    current: () => combined,
    update: (state: State) => {
      combined = state;
    },
    receive: (index: number) => {
      // Receive index of which gadget to trigger
      if (gadgets[index]) {
        const states = gadgets.map(g => g.current());
        combined = combiner(states);
      }
    },
    emit: () => {
      // Merged gadget doesn't emit
    }
  };
}

/**
 * Transform - Apply a transformation to data passing through
 */
export function transform<In, Out, State = Out>(
  transformer: (input: In) => Out,
  gadget: Gadget<State, Out, any>
): Gadget<State, In, any> {
  return {
    current: () => gadget.current(),
    update: (state: State) => gadget.update(state),
    receive: (data: In) => {
      const transformed = transformer(data);
      gadget.receive(transformed);
    },
    emit: (effect: any) => gadget.emit(effect)
  };
}

/**
 * Filter - Only pass data that matches a predicate
 */
export function filter<State, Incoming>(
  predicate: (data: Incoming) => boolean,
  gadget: Gadget<State, Incoming, any>
): Gadget<State, Incoming, any> {
  return {
    current: () => gadget.current(),
    update: (state: State) => gadget.update(state),
    receive: (data: Incoming) => {
      if (predicate(data)) {
        gadget.receive(data);
      }
    },
    emit: (effect: any) => gadget.emit(effect)
  };
}

/**
 * Batch - Accumulate inputs and process in batches
 */
export function batch<State, Incoming>(
  batchSize: number,
  gadget: Gadget<State, Incoming[], any>
): Gadget<State, Incoming, any> {
  let buffer: Incoming[] = [];

  return {
    current: () => gadget.current(),
    update: (state: State) => gadget.update(state),
    receive: (data: Incoming) => {
      buffer.push(data);
      if (buffer.length >= batchSize) {
        gadget.receive([...buffer]);
        buffer = [];
      }
    },
    emit: (effect: any) => gadget.emit(effect)
  };
}

/**
 * Debounce - Only process after a period of inactivity
 */
export function debounce<State, Incoming>(
  delayMs: number,
  gadget: Gadget<State, Incoming, any>
): Gadget<State, Incoming, any> {
  let timeout: NodeJS.Timeout | null = null;

  return {
    current: () => gadget.current(),
    update: (state: State) => gadget.update(state),
    receive: (data: Incoming) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        gadget.receive(data);
        timeout = null;
      }, delayMs);
    },
    emit: (effect: any) => gadget.emit(effect)
  };
}

/**
 * Throttle - Limit processing rate
 */
export function throttle<State, Incoming>(
  intervalMs: number,
  gadget: Gadget<State, Incoming, any>
): Gadget<State, Incoming, any> {
  let lastProcessed = 0;
  let pending: Incoming | null = null;
  let timeout: NodeJS.Timeout | null = null;

  return {
    current: () => gadget.current(),
    update: (state: State) => gadget.update(state),
    receive: (data: Incoming) => {
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessed;

      if (timeSinceLastProcess >= intervalMs) {
        gadget.receive(data);
        lastProcessed = now;
      } else {
        pending = data;
        if (!timeout) {
          timeout = setTimeout(() => {
            if (pending !== null) {
              gadget.receive(pending);
              lastProcessed = Date.now();
              pending = null;
            }
            timeout = null;
          }, intervalMs - timeSinceLastProcess);
        }
      }
    },
    emit: (effect: any) => gadget.emit(effect)
  };
}