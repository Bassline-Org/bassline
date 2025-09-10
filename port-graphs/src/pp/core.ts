import { defMulti } from "./multi";
import _ from "lodash";

// Simple effect creators - let TypeScript infer the types
export const noop = () => ['noop'] as const;
export const changed = <T>(value: T) => ['changed', value] as const;
export const contradiction = <Curr, Inc>(current: Curr, incoming: Inc) =>
  ['contradiction', current, incoming] as const;

export interface Gadget<
  Current extends any = any, Incoming extends any = any, Effect extends any = any> {
  update: (data: Current) => void;
  current: () => Current;
  receive: (data: Incoming) => void;
  emit: (effect: Effect) => void;
}

export function cellFn<T>(multi: T) {
  type Multi = typeof multi extends (cell: Gadget, current: infer Current, incoming: infer Incoming) => infer R
    ? {
      cell: Gadget;
      Current: Current;
      Incoming: Incoming;
      Return: R;
      (c: Gadget, current: Current, incoming: Incoming): R;
    }
    : never;
  const m = multi as Multi;

  return (initial: typeof m['Current']) => {
    let current = initial;
    const cell: Gadget<typeof m['Current'], typeof m['Incoming'], typeof m['Return']> = {
      current: () => current,
      update: (data: typeof m['Current']) => {
        current = data;
      },
      emit: (_effect: typeof m['Return']) => { },
      receive: (data: typeof m['Incoming']) => {
        const effect = m(cell, current, data);
        if (effect !== undefined) {
          cell.emit(effect);
        }
      }
    }
    return cell;
  }
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

  return function <T>(actions: Record<Action, T>, initial: Current) {
    type ActionEffect = typeof actions[keyof typeof actions] extends (gadget: Gadget, current: Current, incoming: Incoming) => infer Effect
      ? Effect
      : never;

    type ActionFn = T extends (gadget: Gadget<Current, Incoming, ActionEffect>, current: Current, incoming: Incoming) => ActionEffect
      ? T
      : never;

    const cases = actions as Record<Action, ActionFn>;

    let current = initial;

    const gadget: Gadget<Current, Incoming, ActionEffect> = {
      current: () => current,
      update: (data) => {
        current = data;
      },
      receive: (data: Incoming) => {
        const action = consider(current, data);
        const actionFn = cases[action] as ActionFn;
        if (actionFn) {
          const effect = actionFn(gadget, current, data) as ActionEffect;
          gadget.emit(effect);
        }
      },
      emit: (effect: ActionEffect) => { }
    }
    return gadget;
  }
}

const foo = createGadget((current: number, incoming: number) => {
  if (!_.isNumber(incoming)) return 'ignore';
  return 'merge';
})({
  'ignore': (gadget, current, incoming) => {
    return noop();
  },
  'merge': (gadget, current, incoming) => {
    return changed(current + incoming);
  }
}, 0);

// // Extract effect type from merge function using infer
// type MergeEffectType<T> = T extends (...args: any[]) => infer R ? R : never;

// // Simple cell interface with proper effect typing
// export interface Cell<TCurrent, TIncoming, TEffect> {
//   current: TCurrent;
//   emit: (effect: TEffect) => void;
//   receive: (data: TIncoming) => void;
// }

// // Cell creator that infers effect types from merge function
// export function createCell<TCurrent, TIncoming, TMerge extends (cell: any, current: TCurrent, incoming: TIncoming) => any>(
//   merge: TMerge,
//   initial: TCurrent
// ): Cell<TCurrent, TIncoming, MergeEffectType<TMerge>> {
//   let current = initial;

//   const cell: Cell<TCurrent, TIncoming, MergeEffectType<TMerge>> = {
//     current,
//     emit: (_effect: MergeEffectType<TMerge>) => { },
//     receive: (data: TIncoming) => {
//       const effect = merge(cell, current, data);
//       if (effect !== undefined) {
//         cell.emit(effect);
//       }
//     },
//   };

//   return cell;
// }

// // Clean merge functions - TypeScript infers everything
// export function setUnion<T>(initial: T[]) {
//   const merge = defMulti((_cell: any, current: T[], incoming: T[]) => {
//     const [curr, inc] = [current, incoming].map(v => v ?? []);
//     if (_.isEqual(curr, inc)) return 'ignore';
//     return 'merge';
//   }).defMethods({
//     'ignore': () => noop(),
//     'merge': (cell: any, current: T[], incoming: T[]) => {
//       const result = _.union(current, incoming);
//       if (!_.isEqual(result, current)) {
//         cell.current = result;
//         return changed(result);
//       } else {
//         return noop();
//       }
//     },
//   });

//   return createCell(merge, initial);
// }

// export function setIntersection<T>(initial: T[]) {
//   const merge = defMulti((_cell: any, current: T[], incoming: T[]) => {
//     const [curr, inc] = [current, incoming].map(v => v ?? []);
//     if (_.intersection(curr, inc).length === 0) return 'contradiction';
//     if (_.isEqual(curr, inc)) return 'ignore';
//     return 'merge';
//   }).defMethods({
//     'ignore': () => noop(),
//     'merge': (cell: any, current: T[], incoming: T[]) => {
//       const result = _.intersection(current, incoming);
//       if (!_.isEqual(result, current)) {
//         cell.current = result;
//         return changed(result);
//       } else {
//         return noop();
//       }
//     },
//     'contradiction': (_cell: any, current: T[], incoming: T[]) =>
//       contradiction(current, incoming),
//   });

//   return createCell(merge, initial);
// }

// export function setDifference<T>(initial: T[]) {
//   const merge = defMulti((_cell: any, current: T[], incoming: T[]) => {
//     const [curr, inc] = [current, incoming].map(v => v ?? []);
//     if (_.isEqual(curr, inc)) return 'ignore';
//     return 'merge';
//   }).defMethods({
//     'ignore': () => noop(),
//     'merge': (cell: any, current: T[], incoming: T[]) => {
//       const result = _.difference(current ?? [], incoming ?? []);
//       if (!_.isEqual(result, current)) {
//         cell.current = result;
//         return changed(result);
//       } else {
//         return noop();
//       }
//     },
//   });

//   return createCell(merge, initial);
// }

// export function max(initial: number) {
//   const merge = defMulti((_cell: any, current: number, incoming: number) => {
//     if (current > incoming) return 'ignore';
//     return 'max';
//   }).defMethods({
//     'ignore': () => noop(),
//     'max': (cell: any, current: number, incoming: number) => {
//       const result = Math.max(current, incoming);
//       if (!_.isEqual(result, current)) {
//         cell.current = result;
//         return changed(result);
//       } else {
//         return noop();
//       }
//     },
//   });

//   return createCell(merge, initial);
// }

// // Clean usage - TypeScript infers everything
// const foo = setUnion<number>([1]);
// const bar = setUnion<number>([]);
// const baz = setIntersection<number>([1, 2, 3, 4, 5]);
// const qux = setDifference<number>([1, 2, 3, 4, 5]);

// foo.emit = (data) => {
//   const [effect, ...args] = data;
//   switch (effect) {
//     case 'changed': {
//       const [result] = args;
//       console.log('foo: ', result);
//       bar.receive(result ?? []);
//       baz.receive(result ?? []);
//       break;
//     }
//     case 'noop': {
//       console.log('foo: noop');
//       break;
//     }
//   }
// };

// bar.emit = (data) => {
//   const [effect, ...args] = data;
//   switch (effect) {
//     case 'changed': {
//       const [result] = args;
//       console.log('bar: ', result);
//       qux.receive(result ?? []);
//       break;
//     }
//     case 'noop': {
//       console.log('bar: noop');
//       break;
//     }
//   }
// };

// baz.emit = (data) => {
//   const [effect, ...args] = data;
//   switch (effect) {
//     case 'changed': {
//       const [result] = args;
//       console.log('baz: ', baz.current);
//       console.log('baz: ', result);
//       break;
//     }
//     case 'noop': {
//       console.log('baz: ', baz.current);
//       console.log('baz: noop');
//       break;
//     }
//   }
// };

// qux.emit = (data) => {
//   const [effect, ...args] = data;
//   switch (effect) {
//     case 'changed': {
//       const [result] = args;
//       console.log('qux: ', qux.current);
//       console.log('qux: ', result);
//       break;
//     }
//   }
// };

// foo.receive([2]);
// foo.receive([3]);

// foo.receive([1]);
// foo.receive([2]);