/**
 * Cell implementations using the typed pattern approach
 */
//import { cellMethods, withTaps, CellSpec, implement } from './betterTypes';
import { implement, cellMethods, CellSpec, withTaps } from '../../core/typed';

export const maxCell = implement<CellSpec<number>>({
  dispatch: (state, input) => {
    if (input > state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  methods: cellMethods()
});

export const minCell = implement<CellSpec<number>>({
  dispatch: (state, input) => {
    if (input < state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  methods: cellMethods()
});

/**
 * Last cell - always keeps the last value received
 */
export const lastCell = <T>(initial: T) => {
  return implement<CellSpec<T>>({
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
  return implement<Spec>({
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

/**
 * Set cell - accumulates unique values
 */
export type SetCell<T> = CellSpec<Set<T>>;

export const unionCell = <T>(initial: Set<T>) => {
  return implement<SetCell<T>>({
    dispatch: (state, input) => {
      if (input.isSubsetOf(state)) {
        return { ignore: {} };
      }
      return { merge: state.union(input) };
    },
    methods: cellMethods()
  })(initial);
};

/**
 * Intersection cell - keeps only common elements
 */
type IntersectionCell<T> = SetCell<T> & {
  actions: {
    contradiction: {
      current: Set<T>;
      incoming: Set<T>;
    };
  }
  effects: {
    contradiction: {
      current: Set<T>;
      incoming: Set<T>;
    }
  };
};

export const intersectionCell = <T>(initial: Set<T>) => {
  type Spec = IntersectionCell<T>;
  return implement<Spec>({
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


const foo = maxCell(1)
const tapped = withTaps(foo);

const bar = unionCell(new Set([4, 5, 6]));