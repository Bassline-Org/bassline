import { defMulti, DispatchKey, MultiMethod } from "./multi";
import _ from "lodash";

const createCell = <Curr, Inc, Actions extends DispatchKey = BaseCellActions>(merge: CellMergeFn<Curr, Inc, Actions>, initial: Curr): Cell<Curr, Inc> => {
  let current = initial;

  const cell: Cell<Curr, Inc> = {
    current: () => current,
    emit: (_effect) => {},
    receive: (data: Inc) => {
      const result = merge(current, data);
      if (!_.isEqual(result, current)) {
        current = result;
        cell.emit(['changed', result]);
      }
    },
  };
  
  return cell;
};

export const setUnion = defMulti((curr: any[], inc: any[]) => {
  const [current, incoming] = [curr, inc].map(v => v ?? []);
  if (_.isEqual(current, incoming)) return 'ignore';
  return 'merge';
})
.defMethods({
  'ignore': (curr, _inc) => curr,
  'merge': (curr, inc) => _.union(curr, inc),
});

export const setIntersection = defMulti((curr: any[], inc: any[]) => {
  const [current, incoming] = [curr, inc].map(v => v ?? []);
  if (_.intersection(current, incoming).length === 0) return 'contradiction';
  if (_.isEqual(current, incoming)) return 'ignore';
  return 'merge';
})
.defMethods({
  'ignore': (curr, _inc) => curr as any[],
  'merge': (curr, inc) => _.intersection(curr, inc) as any[],
  'contradiction': (curr, _inc) => curr as any[],
});

export const setDifference = defMulti((curr: any[], inc: any[]) => {
  const [current, incoming] = [curr, inc].map(v => v ?? []);
  if (_.isEqual(current, incoming)) return 'ignore';
  return 'merge';
})
.defMethods({
  'ignore': (curr, _inc) => curr,
  'merge': (curr, inc) => _.difference(curr ?? [], inc ?? []),
});

const foo = createCell(setUnion, [1]);
const bar = createCell(setUnion, []);
const baz = createCell(setIntersection, [1,2,3,4,5]);
const qux = createCell(setDifference, [1,2,3,4,5]);

foo.emit = (data) => {
  const [effect, ...args] = data;
  switch (effect) {
    case 'changed': {
      const [result] = args;
      console.log('foo: ', result);
      bar.receive(result);
      baz.receive(result);
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
      qux.receive(result);
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
      console.log('baz: ', baz.current());
      console.log('baz: ', result);
      break;
    }
    case 'noop': {
      console.log('baz: ', baz.current());
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
      console.log('qux: ', qux.current());
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
export type CellMergeFn<Curr, Inc, Actions extends DispatchKey = BaseCellActions>
= MultiMethod<[Curr, Inc], Actions, Curr>;

export type BaseCellActions 
= 'ignore' | 'merge';
export type RefinementCellActions
= 'contradiction' | BaseCellActions;

export type CellEffect<Curr> =
['changed', Curr] |
['noop'];

export interface Cell<Curr, Inc> extends Gadget<Inc, CellEffect<Curr>> {
  current: () => Curr;
}