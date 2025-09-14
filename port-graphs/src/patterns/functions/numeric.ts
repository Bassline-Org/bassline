import _ from "lodash";
import { createGadget } from "../../core";
import { changed, noop } from "../../effects";
import { clean } from "../cells/maps";

export function createFn<T extends Record<string, any> & { result: V | undefined }, V>(f: (args: T) => T) {
    function missingKeys(current: T, incoming: Partial<T>) {
        const nonResult = _.omit(current, 'result');
        const allKeys = _.keys(nonResult);
        const [cleanedCurrent, cleanedIncoming] = clean(_.omit(current, 'result'), _.omit(incoming, 'result'));
        return _.difference(allKeys, _.keys(cleanedIncoming), _.keys(cleanedCurrent)).length > 0;
    }
    return (initial: Omit<T, 'result'>) => {
        return createGadget((current: T, incoming: Partial<T>) => {
            // If they are equal, ignore
            if (_.isEqual(current, incoming)) return 'ignore';

            if (missingKeys(current, incoming)) return 'update';

            return 'run';
        })({
            'update': (gadget, current, incoming) => {
                const args = _.merge(current, incoming);
                if (!missingKeys(current, args)) {
                    const result = f(args);
                    gadget.update(result);
                    return changed(result);
                }
                return noop();
            },
            'run': (gadget, current, incoming) => {
                const args = _.merge(current, incoming);
                const result = f(args);
                gadget.update(result);
                return changed(result);
            },
            'ignore': (_gadget, _current, _incoming) => {
                return noop();
            }
        })({ ...initial, result: undefined } as T);
    }
}

export function binary<T extends (a: any, b: any) => any>(f: T) {
    type Func = T extends (a: infer A, b: infer B) => infer R
        ? {
            a: A,
            b: B,
            result: R,
            signature: (a: A, b: B) => R;
        } : never;
    type Args = {
        a: Func['a'];
        b: Func['b'];
        result: Func['result'] | null;
    };

    return createFn<Args, Func['result']>((args: Args) => {
        const func = f as Func['signature'];
        const result = func(args.a, args.b);
        return { ...args, result } as Args;
    });
}

export const adder = binary((a: number = 0, b: number = 0) => a + b);
export const subtractor = binary((a: number, b: number) => a - b);
export const multiplier = binary((a: number, b: number) => a * b);
export const divider = binary((a: number, b: number) => a / b);


const foo = adder({ a: undefined, b: undefined });
foo.receive({ a: 2, b: 3 });
foo.receive({ b: 3 });
foo.receive({ a: 3, b: 4 });