import { defGadget, cellMethods, CellSpec, Contradicts } from '../../core/typed';

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