import { defMulti } from "./multi";
import _ from "lodash";

export function noop() {
  return ['noop'] as const;
}
export function changed<T>(value: T) {
  return ['changed', value] as const;
}
export function contradiction<Curr, Inc>(cell: Cell<Curr, Inc, unknown>, current: Curr, incoming: Inc) {
  return ['contradiction', cell, current, incoming] as const;
}


const createCell = <
  TMerge extends (...args: any[]) => any
>(
  merge: TMerge,
  initial: any
): Cell<any, any, ReturnType<TMerge>> => {
  let current = initial;

  const cell: Cell<any, any, ReturnType<TMerge>> = {
    current,
    // By default emit does nothing, this can be override based on the context
    emit: (_effect) => {},
    receive: (data: any) => {
      const effect = merge(cell, current, data);
      if (effect !== undefined) {
        cell.emit(effect);
      }
    },
  };

  return cell;
};

export const setUnion = <T>() => defMulti((_cell: Cell<T[], T[], any>, current: T[], incoming: T[]) => {
  const [curr, inc] = [current, incoming].map(v => v ?? []);
  if (_.isEqual(curr, inc)) return 'ignore';
  return 'merge';
}).defMethods({
  'ignore': (_cell, _current, _incoming) => {
    return noop();
  },
  'merge': (cell, current, incoming) => {
    const result = _.union(current, incoming);
    if (!_.isEqual(result, current)) {
      cell.current = result;
      return changed(result);
    } else {
      return noop();
    }
  },
});

export const setIntersection = <T>() => defMulti((_cell: Cell<T[], T[], any>, current: T[], incoming: T[]) => {
  const [curr, inc] = [current, incoming].map(v => v ?? []);
  if (_.intersection(curr, inc).length === 0) return 'contradiction';
  if (_.isEqual(curr, inc)) return 'ignore';
  return 'merge';
}).defMethods({
  'ignore': (_cell, _current, _incoming) => {
    return noop();
  },
  'merge': (cell, current, incoming) => {
    const result = _.intersection(current, incoming);
    if (!_.isEqual(result, current)) {
      cell.current = result;
      return changed(result);
    } else {
      return noop();
    }
  },
  'contradiction': (cell, _current, _incoming) => {
    return contradiction(cell, _current, _incoming);
  },
});

export const setDifference = <T>() => defMulti((_cell: Cell<T[], T[], any>, current: T[], incoming: T[]) => {
  const [curr, inc] = [current, incoming].map(v => v ?? []);
  if (_.isEqual(curr, inc)) return 'ignore';
  return 'merge';
}).defMethods({
  'ignore': (_cell, _current, _incoming) => {
    return noop();
  },
  'merge': (cell, current, incoming) => {
    const result = _.difference(current ?? [], incoming ?? []);
    if (!_.isEqual(result, current)) {
      cell.current = result;
      return changed(result);
    } else {
      return noop();
    }
  },
});

export const max = defMulti((_cell: Cell<number, number, any>, current: number, incoming: number) => {
  if (current > incoming) return 'ignore';
  return 'max';
}).defMethods({
  'ignore': (_cell, _current, _incoming) => {
    return noop();
  },
  'max': (cell, current, incoming) => {
    const result = Math.max(current, incoming);
    if (!_.isEqual(result, current)) {
      cell.current = result;
      return changed(result);
    } else {
      return noop();
    }
  },
});

const foo = createCell(setUnion<number>(), [1]);
const bar = createCell(setUnion<number>(), [] as number[]);
const baz = createCell(setIntersection<number>(), [1,2,3,4,5]);
const qux = createCell(setDifference<number>(), [1,2,3,4,5]);

foo.emit = (data) => {
  const [effect, ...args] = data;
  switch (effect) {
    case 'changed': {
      const [result] = args;
      console.log('foo: ', result);
      bar.receive(result ?? []);
      baz.receive(result ?? []);
      break;
    }
    case 'noop': {
      console.log('foo: noop');
      break;
    }
  }
};

bar.emit = (data) => {
  const [effect, ...args] = data;
  switch (effect) {
    case 'changed': {
      const [result] = args;
      console.log('bar: ', result);
      qux.receive(result ?? []);
      break;
    }
    case 'noop': {
      console.log('bar: noop');
      break;
    }
  }
};

baz.emit = (data) => {
  const [effect, ...args] = data;
  switch (effect) {
    case 'changed': {
      const [result] = args;
      console.log('baz: ', baz.current);
      console.log('baz: ', result);
      break;
    }
    case 'noop': {
      console.log('baz: ', baz.current);
      console.log('baz: noop');
      break;
    }
  }
};

qux.emit = (data) => {
  const [effect, ...args] = data;
  switch (effect) {
    case 'changed': {
      const [result] = args;
      console.log('qux: ', qux.current);
      console.log('qux: ', result);
      break;
    }
  }
};

foo.receive([2]);
foo.receive([3]);

foo.receive([1]);
foo.receive([2]);

// ================================
// Types
// ================================

export interface Gadget<TIn, Effect> {
  receive: (data: TIn) => void;
  emit: (data: Effect) => void;
}

export type CellMergeFn<Curr, Inc, TEffects = unknown> = (cell: Cell<Curr, Inc, TEffects>, current: Curr, incoming: Inc) => TEffects | undefined;


export interface Cell<Curr, Inc, TEffects = unknown> extends Gadget<Inc, TEffects> {
  current: Curr;
}