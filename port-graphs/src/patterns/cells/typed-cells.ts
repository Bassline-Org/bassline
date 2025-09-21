/**
 * Cell implementations using the typed pattern approach
 */

import _ from 'lodash';
import { defGadget } from '../../core/typed';
import type { CellSpec } from '../specs';

/**
 * Max cell - keeps the maximum value seen
 */
export type NumericCell = CellSpec<number, number>;

export const maxCell = defGadget<NumericCell>(
  (state, input) => {
    if (input > state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  {
    merge: (gadget, value) => {
      gadget.update(value);
      return { changed: value };
    },
    ignore: () => ({ noop: {} })
  }
);

/**
 * Min cell - keeps the minimum value seen
 */
export const minCell = defGadget<NumericCell>(
  (state, input) => {
    if (input < state) {
      return { merge: input };
    }
    return { ignore: {} };
  },
  {
    merge: (gadget, value) => {
      gadget.update(value);
      return { changed: value };
    },
    ignore: () => ({ noop: {} })
  }
);

/**
 * Last cell - always keeps the last value received
 */
export const lastCell = <T>(initial: T) => {
  type Spec = CellSpec<T, T>;
  return defGadget<Spec>(
    (_state, input) => {
      return { merge: input };  // Always take the new value
    },
    {
      merge: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
};

export type Ordinal<T> = [number, T];
export type OrdinalCell<T> = CellSpec<Ordinal<T>, Ordinal<T>>;

export const ordinalCell = <T>(initial: Ordinal<T>) => {
  type Spec = OrdinalCell<T>;
  return defGadget<Spec>(
    (state, input) => {
      if (state[0] < input[0]) {
        return { merge: input };
      } else {
        return { ignore: {} };
      }
    },
    {
      merge: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
};

/**
 * Set cell - accumulates unique values
 */
export type SetCell<T> = CellSpec<Set<T>, T[] | Set<T>>;

export const unionCell = <T>(initial: Set<T>) => {
  return defGadget<SetCell<T>>(
    (state, input) => {
      const asSet = _.isSet(input)
        ? input
        : new Set(input);
      if (asSet.isSubsetOf(state)) {
        return { ignore: {} };
      }
      return { merge: asSet };
    },
    {
      merge: (gadget, value) => {
        const union = gadget.current().union(value as Set<T>);
        gadget.update(union);
        return { changed: union };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
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
  return defGadget<IntersectionCell<T>>(
    (state, input) => {
      const asSet = _.isSet(input)
        ? input
        : new Set(input);
      const intersection = state.intersection(asSet);
      if (intersection.size === 0) {
        return { contradiction: { current: state, incoming: asSet } };
      }
      if (intersection.size === state.size) {
        return { ignore: {} };
      }
      return { merge: intersection };
    },
    {
      merge: (gadget, value) => {
        const intersection = gadget.current().intersection(value as Set<T>);
        gadget.update(intersection);
        return { changed: intersection };
      },
      contradiction: (gadget, err) => ({ contradiction: err }),
      ignore: (gadget) => ({ noop: {} })
    }
  )(initial);
};