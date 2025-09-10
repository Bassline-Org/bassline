import _ from "lodash";
import { noop, changed, contradiction } from "./effects";

export type GadgetDetails<G> = G extends Gadget<infer Current, infer Incoming, infer Effect> ? Gadget & {
  current: Current;
  incoming: Incoming;
  effect: Effect;
  emit: G['emit'];
  receive: G['receive'];
  update: G['update'];
} : never;

export const effects = {
  noop,
  changed,
  contradiction,
  creation: (gadget: Gadget) => ['creation', gadget] as const,
}

export function compatibleEffects<F, T>(fromGadget: F, toGadget: T) {
  type FromEffects = GadgetDetails<F>['effect'];
  type ToEffects = GadgetDetails<T>['effect'];

  type CommonEffects = FromEffects & ToEffects;

  return [fromGadget as F & { emit: (effect: CommonEffects) => void },
  toGadget as T & { emit: (effect: CommonEffects) => void }] as const;
}

export const wires = {
  directed: <From, To>(fromGadget: From, toGadget: To) => {
    type FromDetails = GadgetDetails<From>;
    type ToDetails = GadgetDetails<To>;
    const from = fromGadget as FromDetails;
    const to = toGadget as ToDetails;
    const oldEmit = from.emit;
    from.emit = (effect) => {
      const [kind, ...args] = effect;
      if (kind === 'changed') {
        to.receive(args[0]);
      }
      oldEmit(effect);
    }
  },
  bi: <From extends Gadget, To extends Gadget>(from: From, to: To) => {
    const fromEmit = from.emit;
    from.emit = (effect) => {
      const [kind, ...args] = effect;
      if (kind === 'changed') {
        to.receive(args[0]);
      }
      fromEmit(effect);
    }
    const toEmit = to.emit;
    to.emit = (effect) => {
      const [kind, ...args] = effect;
      if (kind === 'changed') {
        from.receive(args[0]);
      }
      toEmit(effect);
    }
  }
}

export interface Gadget<
  Current extends any = any, Incoming extends any = any, Effect extends any = any> {
  update: (data: Current) => void;
  current: () => Current;
  receive: (data: Incoming) => void;
  emit: (effect: Effect) => void;
}

export function createGadget<T>(multi: T) {
  type Consider = typeof multi extends (current: infer Current, incoming: infer Incoming) => infer R
    ? {
      current: Current;
      incoming: Incoming;
      action: R extends string | number | symbol ? R : never;
      signature: (current: Current, incoming: Incoming) => Consider['action'];
    }
    : never;
  type Action = Consider['action'];
  type Current = Consider['current'];
  type Incoming = Consider['incoming'];

  const consider = multi as Consider['signature'];

  return function <Actions extends Record<Action, (gadget: Gadget<Current, Incoming, any>, current: Current, incoming: Incoming) => any>>(
    actions: Actions
  ) {
    type AllEffects = {
      [K in keyof Actions]: Actions[K] extends (...args: any[]) => infer R ? R : never
    }[keyof Actions];

    const cases = actions as Record<Action, Actions[keyof Actions]>;

    return (initial: Current) => {
      let current = initial;
      const gadget: Gadget<Current, Incoming, AllEffects> = {
        current: () => current,
        update: (data) => {
          current = data;
        },
        receive: (data: Incoming) => {
          const action = consider(current, data);
          const actionFn = cases[action];
          if (actionFn) {
            const effect = actionFn(gadget, current, data);
            gadget.emit(effect);
          }
        },
        emit: (effect: AllEffects) => { }
      }
      return gadget;
    }
  }
}

export const unionCell = createGadget((current: any[], incoming: any[]) => {
  if (incoming.length > current.length) return 'merge';
  if (_.isEmpty(_.difference(current, incoming))) return 'ignore';
  return 'merge';
})({
  'merge': (gadget, current, incoming) => {
    const result = _.union(current, incoming) as any[];
    if (_.difference(result, current).length > 0) {
      gadget.update(result);
      return changed(result);
    }
    return noop();
  },
  'ignore': (_gadget, _current, _incoming) => {
    return noop();
  }
});

export const differenceCell = createGadget((current: any[], incoming: any[]) => {
  if (_.isEmpty(_.difference(current, incoming))) return 'ignore';
  return 'merge';
})({
  'merge': (gadget, current, incoming) => {
    const result = _.difference(current, incoming) as any[];
    if (result.length > 0) {
      gadget.update(result);
      return changed(result);
    } else {
      return contradiction(current, incoming);
    }
  },
  'ignore': (_gadget, _current, _incoming) => {
    return noop();
  }
});

export const intersectionCell = createGadget((current: any[], incoming: any[]) => {
  const overlap = _.intersection(current, incoming);
  if (_.isEmpty(overlap)) return 'contradiction';
  if (overlap.length === current.length) return 'ignore';
  return 'merge';
})({
  'merge': (gadget, current, incoming) => {
    const result = _.intersection(current, incoming) as any[];
    if (result.length > 0) {
      gadget.update(result);
      return changed(result);
    } else {
      return contradiction(current, incoming);
    }
  },
  'ignore': (_gadget, _current, _incoming) => {
    return noop();
  },
  'contradiction': (_gadget, current, incoming) => {
    return contradiction(current, incoming);
  }
});

const a = unionCell([1, 2, 3]);
const b = unionCell([4, 5, 6]);
const c = intersectionCell([1, 2, 3, 4, 5, 6, 7]);
const d = intersectionCell(c.current());
const max = createGadget((current: number, incoming: number) => {
  if (current >= incoming) return 'ignore';
  return 'merge';
})({
  'merge': (gadget, current, incoming) => {
    const result = Math.max(current, incoming);
    gadget.update(result);
    return changed(result);
  },
  'ignore': (_gadget, _current, _incoming) => noop()
});
const e = max(0);

const [a2, b2] = compatibleEffects(a, b);
wires.directed(a2, b2);

a.receive([7, 8, 9]);

console.log('a: ', a2.current());
console.log('b: ', b2.current());

a.receive([7, 8, 9]);
a.receive([7, 8, 9]);

console.log('a: ', a2.current());
console.log('b: ', b2.current());

// c.emit = (e) => {
//   console.log('c.emit: ', e);
//   const [effect, ...args] = e;
//   if (effect === 'changed') {
//     const [result] = args;
//     d.receive(result!);
//   }
// }

// d.emit = (e) => {
//   console.log('d.emit: ', e);
//   const [effect, ...args] = e;
//   if (effect === 'changed') {
//     const [result] = args;
//     c.receive(result!);
//   }
// }

// c.receive(a.current());
// d.receive(b.current());
// console.log('c: ', c.current());
// console.log('d: ', d.current());

// b.emit = (e) => {
//   const [effect, ...args] = e;
//   if (effect === 'changed') {
//     const [result] = args;
//     a.receive(result!);
//   }
// }

// console.log('a: ', a.current());
// console.log('b: ', b.current());

// a.receive([7, 8, 9]);

// console.log('a: ', a.current());
// console.log('b: ', b.current());
// console.log('equal?: ', _.isEqual(_.difference(a.current(), b.current()), []));