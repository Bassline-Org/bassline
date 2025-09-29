import { Actions, defGadget, derive, Effects, Gadget, Input, Methods, SpecOf, State, withTaps } from '../../core/typed';
import { maxCell, unionCell } from './typed-cells';

type Spec<T> = State<T | null> & Input<T> & Actions<
    {
        met: T
        notMet: T
        ignore: {}
        alreadyMet: { existing: T, incoming: T }
    }
> & Effects<{
    changed?: T;
    notMet?: T;
    alreadyMet?: { existing: T, incoming: T };
    noop?: {};
}>;

type Example = Spec<number>;

type G = Gadget<Example>;
type ExampleSpec = SpecOf<G>;
type Foo = ExampleSpec['actions']
type ExampleActions = Methods<G>;

// const ex = (predicate: (value: number) => boolean) => defGadget<Spec<number>>({
//     dispatch: (state, input) => {
//         if (state !== null) {
//             return { alreadyMet: { existing: state, incoming: input } };
//         }
//         if (predicate(input)) {
//             return { met: input };
//         }
//         return { notMet: input };
//     },
//     methods: {
//         met: (gadget, value) => { },
//         notMet: (gadget, value) => { },
//         ignore: () => ({ noop: {} }),
//         alreadyMet: (gadget, { existing, incoming }) => ({ noop: {} }),
//     }
// })

export const thresholdCell = <T>(predicate: (value: T) => T | null) => {
    type Spec = State<T | null> & Input<T> & Actions<
        {
            met?: T
            notMet?: T
            ignore?: {}
            alreadyMet?: { existing: T, incoming: T }
        }
    > & Effects<{
        changed?: T;
        notMet?: T;
        alreadyMet?: { existing: T, incoming: T };
        noop?: {};
    }>;

    return defGadget<Spec>({
        dispatch: (state, input) => {
            if (state !== null) {
                return { alreadyMet: { existing: state, incoming: input } };
            }
            if (predicate(input)) {
                return { met: input };
            }
            return { notMet: input };
        },
        methods: {
            met: (gadget, value) => {
                gadget.update(value);
                return { changed: value };
            },
            notMet: (gadget, value) => {
                return { notMet: value };
            },
            alreadyMet: (gadget, { existing, incoming }) => {
                return { alreadyMet: { existing, incoming } };
            },
            ignore: () => ({ noop: {} })
        }
    })(null);
}

const above10 = withTaps(thresholdCell((value: number) => value > 10 ? value : null));
const includes5 = withTaps(thresholdCell((value: Set<number>) => value.has(5) ? value : null));
const union = withTaps(unionCell(new Set([1, 2, 3])));

const unionSum = withTaps(derive(union, (value) => Array.from(value).reduce((acc, x) => acc + x, 0)));

unionSum.tap(({ changed }) => {
    if (changed) {
        console.log('unionSum', changed);
    }
});

above10.tap(({ notMet, changed, alreadyMet }) => {
    if (notMet) {
        console.log('notMet', notMet);
    }
    if (changed) {
        console.log('changed', changed);
    }
    if (alreadyMet) {
        console.log('alreadyMet', alreadyMet);
    }
});

union.tap(({ changed }) => {
    if (changed) {
        includes5.receive(changed);
    }
});

includes5.tap(({ notMet, changed, alreadyMet }) => {
    if (notMet) {
        console.log('notMet', notMet);
    }
    if (changed) {
        console.log('changed', changed);
    }
});

const number = withTaps(maxCell(0));

number.tap(({ changed }) => {
    if (changed) {
        above10.receive(changed);
    }
});

number.receive(1);

number.receive(5);

number.receive(15);

number.receive(20);

union.receive(new Set([4, 8, 9, 10]));
union.receive(new Set([11, 12, 13, 14]));
union.receive(new Set([5, 8, 10]));