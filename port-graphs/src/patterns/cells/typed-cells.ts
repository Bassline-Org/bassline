import { defGadget, cellMethods, CellSpec, Contradicts, State, Input, Actions, Effects } from '../../core/typed';

// ============================================
// NUMERIC CELLS
// ============================================

export const maxCell = defGadget<CellSpec<number>>({
  dispatch: (state, input) => {
    if (input > state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  methods: cellMethods()
});

export const minCell = defGadget<CellSpec<number>>({
  dispatch: (state, input) => {
    if (input < state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  methods: cellMethods()
});

// ============================================
// GENERIC CELLS
// ============================================

export const lastCell = <T>(initial: T) => {
  return defGadget<CellSpec<T>>({
    dispatch: (_state, input) => {
      return { merge: input };  // Always take the new value
    },
    methods: cellMethods()
  })(initial);
};

export type Ordinal<T> = [number, T];
export type OrdinalCell<T> = CellSpec<Ordinal<T>>;

export const ordinalCell = <T>(initial: Ordinal<T>) => {
  type Spec = OrdinalCell<T>;
  return defGadget<Spec>({
    dispatch: (state, input) => {
      if (state[0] < input[0]) {
        return { merge: input };
      } else {
        return { ignore: {} };
      }
    },
    methods: cellMethods()
  })(initial);
};

// ============================================
// SET CELLS
// ============================================

export type SetCell<T> = CellSpec<Set<T>>;
export const unionCell = <T>(initial: Set<T>) => {
  return defGadget<SetCell<T>>({
    dispatch: (state, input) => {
      if (input.isSubsetOf(state)) {
        return { ignore: {} };
      }
      return { merge: state.union(input) };
    },
    methods: cellMethods()
  })(initial);
};

type IntersectionCell<T> = Contradicts<SetCell<T>>;
export const intersectionCell = <T>(initial: Set<T>) => {
  type Spec = IntersectionCell<T>;
  return defGadget<Spec>({
    dispatch: (state, input) => {
      const intersection = state.intersection(input);
      if (intersection.size === 0) {
        return { contradiction: { current: state, incoming: input } };
      }
      if (intersection.size === state.size) {
        return { ignore: {} };
      }
      return { merge: intersection };
    },
    methods: {
      ...cellMethods(),
      contradiction: (gadget, err) => ({ contradiction: err }),
    }
  })(initial);
};

// Define custom spec by composing pieces
export type CounterSpec =
  & State<number>
  & Input<{ increment?: number; decrement?: number; reset?: boolean }>
  & Actions<{
    add: number;
    subtract: number;
    reset: {};
    ignore: {};
  }>
  & Effects<{
    changed: number;
    overflow: number;
    underflow: number;
    noop: {};
  }>;

export const counter = (initial: number, min = -100, max = 100) => defGadget<CounterSpec>({
  dispatch: (state, input) => {
    if (input.reset) return { reset: {} };
    if (input.increment) {
      const next = state + input.increment;
      if (next > max) return { add: max - state };  // Clamp
      return { add: input.increment };
    }
    if (input.decrement) {
      const next = state - input.decrement;
      if (next < min) return { subtract: state - min };  // Clamp
      return { subtract: input.decrement };
    }
    return { ignore: {} };
  },

  methods: {
    add: (gadget, amount) => {
      const next = gadget.current() + amount;
      gadget.update(next);
      return next >= max
        ? { changed: next, overflow: next }
        : { changed: next };
    },

    subtract: (gadget, amount) => {
      const next = gadget.current() - amount;
      gadget.update(next);
      return next <= min
        ? { changed: next, underflow: next }
        : { changed: next };
    },

    reset: (gadget) => {
      gadget.update(initial);
      return { changed: initial };
    },

    ignore: () => ({ noop: {} })
  }
})(initial);