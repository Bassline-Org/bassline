import _ from "lodash";
import { defGadget } from "../../core/typed";
import { ExtractSpec, TypedGadget } from "../../core/types";
import { Tappable, TappableGadget, withTaps } from "../../semantics";
import { CellSpec } from "../specs";
import { lastMap } from "./typed-maps";

export type CellTableSpec<Key extends string, S extends Omit<CellSpec<unknown, unknown, unknown>, 'actions'>> = {
    state: {
        cells: Record<Key, TappableGadget<S>>;
        cleanups: Record<Key, () => void>;
    };
    input: Record<Key, TappableGadget<S> | null>;
    actions: {
        merge: {
            added: Record<Key, TappableGadget<S>>;
            removed: Record<Key, TappableGadget<S>>;
        };
        ignore: {};
    };
    effects: {
        changed: Record<Key, TappableGadget<S>>;
        cellChanged: Record<Key, TappableGadget<S>>;
        added: Record<Key, TappableGadget<S>>;
        removed: Record<Key, TappableGadget<S>>;
        noop: {};
    };
};

export const cellTable = <Key extends string, S extends Omit<CellSpec<unknown, unknown, unknown>, 'actions'>>(
    initial: Record<Key, TappableGadget<S>> = {} as typeof initial
) => {
    type Spec = CellTableSpec<Key, S>;

    const gadget = defGadget<Spec>(
        (state, input) => {
            const added = {} as Spec['state']['cells'];
            const removed = {} as Spec['state']['cells'];

            for (const key in input) {
                const incoming = input[key];

                if (incoming === null) {
                    if (state.cells[key] !== undefined) {
                        removed[key] = state.cells[key];
                    }
                } else {
                    if (state.cells[key] !== incoming) {
                        added[key] = incoming as TappableGadget<S>;
                    }
                }
            }

            if (_.isEmpty(added) && _.isEmpty(removed)) {
                return { ignore: {} };
            } else {
                return { merge: { added, removed } };
            }
        },
        {
            merge: (gadget, { added, removed }) => {
                const state = gadget.current();
                const newCells = { ...state.cells };
                const newCleanups = { ...state.cleanups };

                // Remove cells and clean up taps
                for (const key in removed) {
                    const cleanup = newCleanups[key];
                    cleanup?.();  // Clean up the tap!
                    delete newCleanups[key];
                    delete newCells[key];
                }

                // Add cells and set up taps
                for (const key in added) {
                    const cell = added[key] as Spec['effects']['cellChanged'][Key];

                    // Tap into the cell to watch for changes
                    const cleanup = cell.tap(({ changed }) => {
                        if (changed) {
                            const cellChanged = { [key]: cell };
                            gadget.emit({ cellChanged } as Spec['effects']);
                        }
                    });

                    newCells[key] = cell;
                    newCleanups[key] = cleanup;
                }

                gadget.update({ cells: newCells, cleanups: newCleanups });
                return { changed: newCells, added, removed };
            },
            ignore: () => ({ noop: {} })
        }
    )({ cells: {}, cleanups: {} } as Spec['state']);

    gadget.receive(initial);

    return withTaps(gadget);
};

const foo = withTaps(lastMap({}));
const bar = withTaps(lastMap({}));

const exampleTable = cellTable<string, ExtractSpec<typeof foo>>({
    foo,
    bar,
});

console.log('exampleTable', exampleTable.current());

exampleTable.tap(({ cellChanged }) => {
    if (cellChanged) {
        for (const key in cellChanged) {
            const value = cellChanged[key]?.current();
            console.log('cellChanged', key, value);
        }
    }
});

foo.receive({ a: 1 });
bar.receive({ a: 2 });

foo.receive({ a: 3 });
bar.receive({ a: 4 });

exampleTable.receive({ foo: null, bar: null });

foo.receive({ a: 5 });
bar.receive({ a: 6 });

console.log('foo', foo.current());
console.log('bar', bar.current());

exampleTable.receive({ foo });