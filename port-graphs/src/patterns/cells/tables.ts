import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { CellSpec } from '../specs';
import { ExtractSpec, TypedGadget } from '../../core/types';
import { Tappable, withTaps } from '../../semantics';
import { lastMap } from './typed-maps';
import { adder } from '../functions';

export type TableSpec<Key extends string | number | symbol, Entry> = CellSpec<
    Record<Key, Entry>,
    Record<Key, Entry | null>,
    {
        added: Record<Key, Entry>;
        removed: Record<Key, Entry>;
    }
> & {
    effects: {
        // The changed effect is the full table state
        changed: Record<Key, Entry>;
        // Added rows
        added: Record<Key, Entry>;
        // Removed rows
        removed: Record<Key, Entry>;
    };
};

// A table is just a table - no transform
export const table = <Entry, Key extends string | number | symbol = string | number | symbol>(
    initial: Record<Key, Entry> = {} as typeof initial
) => {

    const initialData = {} as Record<Key, Entry>;

    for (const key in initial) {
        initialData[key] = { ...initial[key] };
    }

    const gadget = defGadget<TableSpec<Key, Entry>>(
        (state, input) => {
            const added = {} as Record<Key, Entry>;
            const removed = {} as Record<Key, Entry>;

            for (const key in input) {
                const incoming = input[key];

                if (incoming === null) {
                    if (state[key] !== undefined) {
                        removed[key] = state[key];
                    }
                } else {
                    if (state[key] !== incoming) {
                        added[key] = { ...state[key], ...incoming };
                    }
                }
            }

            if (_.isEmpty(added) && _.isEmpty(removed)) {
                return { ignore: {} };
            }

            return { merge: { added, removed } };
        },
        {
            merge: (gadget, { added, removed }) => {
                const newState = { ...gadget.current() };

                for (const key in added) {
                    newState[key] = added[key];
                }

                for (const key in removed) {
                    delete newState[key];
                }

                gadget.update(newState);
                return { changed: newState, added, removed };
            },
            ignore: () => ({ noop: {} })
        }
    )(initialData);
    return withTaps(gadget);
};

export const derive = <Derived, Source = Derived, Key extends string | number | symbol = string | number | symbol>(
    source: TypedGadget<TableSpec<Key, Source>> & Tappable<TableSpec<Key, Source>['effects']>,
    transform: (key: Key, value: Source) => [Key, Derived | null]
) => {

    // Compute the initial state of the derived table
    const initial = {} as Record<Key, Derived>;
    const currentSource = source.current();
    for (const key in currentSource) {
        const value = currentSource[key];
        const [derivedKey, derivedValue] = transform(key, value);
        if (derivedValue !== null) {
            initial[derivedKey] = derivedValue;
        }
    }

    const derived = withTaps(table<Derived>(initial));

    // Wire with transformation
    source.tap(({ added, removed }) => {
        const updates = {} as Record<Key, Derived | null>;

        // Apply the transform to the added items
        if (added) {
            for (const key in added) {
                const [derivedKey, value] = transform(key, added[key]);
                updates[derivedKey] = value;
            }
        }

        // Handle explicit removals
        if (removed) {
            for (const key in removed) {
                updates[key] = null;
            }
        }

        derived.receive(updates);
    });

    return derived;
};

// Join is just a function that runs once and returns a result
function join<K1 extends keyof any, K2 extends keyof any, V1, V2>(
    left: Record<K1, V1>,
    right: Record<K2, V2>,
    on: (l: { key: K1, value: V1 }, r: { key: K2, value: V2 }) => boolean
): Array<V1 & V2> {
    const results = [] as Array<V1 & V2>;
    for (const lKey in left) {
        for (const rKey in right) {
            const lRow = left[lKey];
            const rRow = right[rKey];
            if (on({ key: lKey, value: lRow }, { key: rKey, value: rRow })) {
                results.push({ ...lRow, ...rRow });
            }
        }
    }
    return results;
}

type Pos = { x: number, y: number };
const exampleTable = table<Pos>({});
const derivedTable = derive<Pos>(exampleTable, (id, { x, y }) => [id, { x: x + 10, y: y + 10 }]);
const derivedDerivedTable = derive<Pos & { sum: number }, Pos>(derivedTable, (id, { x, y }) => [id, { x: x + 10, y: y + 10, sum: x + y }]);

derivedTable.tap(({ added, removed }) => {
    console.log('added', added);
    console.log('removed', removed);
});

derivedDerivedTable.tap(({ added, removed }) => {
    console.log('added', added);
    console.log('removed', removed);
});

console.log('exampleTable', exampleTable.current());

exampleTable.receive({
    a: { x: 1, y: 2 },
    b: { x: 20, y: 30 },
    c: { x: 3, y: 4 },
});

console.log('exampleTable', exampleTable.current());
console.log('derivedTable', derivedTable.current());
console.log('derivedDerivedTable', derivedDerivedTable.current());

exampleTable.receive({
    c: { x: 5, y: 6 },
});

exampleTable.receive({
    c: null,
});

console.log('exampleTable', exampleTable.current());
console.log('derivedTable', derivedTable.current());
console.log('derivedDerivedTable', derivedDerivedTable.current());

const joined = join(derivedDerivedTable.current(), exampleTable.current(), (l, r) => l.key === r.key);
console.log('joined', joined);