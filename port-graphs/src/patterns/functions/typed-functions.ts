/**
 * Function gadget implementations using the typed pattern approach
 */

import * as _ from 'lodash';
import { Actions, defGadget, Derivable, Effects, Gadget, Input, State, withTaps } from '../../core/typed';

type FnArgs<T> = T extends (args: infer Args) => any ? Args extends Record<string, unknown> ? Args : never : never;
type FnResult<T> = T extends (args: infer Args) => infer Result ? Result : never;
type FnRecord<Fn> = FnArgs<Fn> & { result: FnResult<Fn> };

export function fn<Compute extends (args: any) => any>(compute: Compute, requiredKeys: (keyof FnArgs<Compute>)[]) {
  type S = State<FnRecord<Compute>>;
  type I = Input<Partial<FnArgs<Compute>>>;
  type A = Actions<{
    compute: FnArgs<Compute>;
    accumulate: Partial<FnArgs<Compute>>;
    ignore: {};
  }>;
  type E = Effects<{
    changed: FnRecord<Compute>;
    computed: FnResult<Compute>;
    noop: {};
  }>;
  type Spec = S & I & A & E;

  return (initial: FnArgs<Compute>) => defGadget<Spec>({
    dispatch: (state, input) => {
      if (_.isEmpty(input)) {
        return { ignore: {} };
      }
      const merged = { ...state, ...input };
      const noRequiredKeys = requiredKeys.length === 0;
      const hasAll = noRequiredKeys || requiredKeys.every(key => merged[key] !== undefined);

      if (_.isEqual(merged, state)) {
        return { ignore: {} };
      }
      if (!hasAll) {
        return { accumulate: input };
      }
      if (noRequiredKeys) {
        return { compute: _.omit(merged, 'result') as FnArgs<Compute> };
      } else {
        const picked = _.pick(merged, requiredKeys);
        return { compute: _.omit(picked, 'result') as FnArgs<Compute> };
      }
    },
    methods: {
      compute: (gadget, args) => {
        const result = compute(args);
        gadget.update({ ...args, result });
        return { changed: gadget.current(), computed: result };
      },
      accumulate: (gadget, args) => {
        const current = gadget.current();
        gadget.update({ ...current, ...args });
        return { noop: {} }
      },
      ignore: () => ({ noop: {} })
    }
  })({ ...initial, result: compute(initial) } as FnRecord<Compute>)
}

type ExampleFn = (args: { foo: number, bar: number }) => number;
const exampleFn: ExampleFn = (args) => args.foo + args.bar;
const example = fn(exampleFn, ['foo', 'bar']);

const nary = fn((args: Record<string, number>) => {
  return Object.values(args).reduce((acc, val) => acc + val, 0);
}, []);

const foo = withTaps(nary({ a: 1, b: 2, c: 3 }));

foo.tap(({ computed }) => {
  console.log('nary computed', computed);
});
foo.receive({
  a: 10,
  b: 20,
  c: 30
});
foo.receive({
  c: 10
})
foo.receive({ d: 1 });

//console.log('foo', foo.current().result);

// /**
//  * Binary function helper
//  */
// export function binary<A, B, R>(
//   fn: (a: A, b: B) => R
// ) {
//   return typedFn<{ a: A; b: B }, R>(
//     args => fn(args.a, args.b),
//     ['a', 'b']
//   );
// }

// /**
//  * Unary function helper
//  */
// export function unary<A, R>(
//   fn: (a: A) => R
// ) {
//   return typedFn<{ value: A }, R>(
//     args => fn(args.value),
//     ['value']
//   );
// }

// /**
//  * Common math functions
//  */
// export const adder = binary<number, number, number>((a, b) => a + b);
// export const multiplier = binary<number, number, number>((a, b) => a * b);
// export const divider = binary<number, number, number>((a, b) => a / b);
// export const subtractor = binary<number, number, number>((a, b) => a - b);

// export const square = unary<number, number>(x => x * x);
// export const sqrt = unary<number, number>(x => Math.sqrt(x));
// export const negate = unary<number, number>(x => -x);

// /**
//  * String functions
//  */
// export const concat = binary<string, string, string>((a, b) => a + b);
// export const uppercase = unary<string, string>(s => s.toUpperCase());
// export const lowercase = unary<string, string>(s => s.toLowerCase());

// /**
//  * Boolean functions
//  */
// export const and = binary<boolean, boolean, boolean>((a, b) => a && b);
// export const or = binary<boolean, boolean, boolean>((a, b) => a || b);
// export const not = unary<boolean, boolean>(x => !x);

// /**
//  * Comparison functions
//  */
// export const equals = binary<any, any, boolean>((a, b) => a === b);
// export const lessThan = binary<number, number, boolean>((a, b) => a < b);
// export const greaterThan = binary<number, number, boolean>((a, b) => a > b);

// /**
//  * Array functions
//  */
// export const arrayLength = unary<any[], number>(arr => arr.length);
// export const arrayFirst = unary<any[], any>(arr => arr[0]);
// export const arrayLast = unary<any[], any>(arr => arr[arr.length - 1]);