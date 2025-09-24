import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { ExtractSpec, TypedGadget } from '../../core/types';
import { Tappable, withTaps, TappableGadget } from '../../semantics';
import { CellSpec } from '../specs';
import { lastMap } from './typed-maps';

function detectTableChanges<Key extends string | number | symbol, Entry>(
    state: Record<Key, Entry>,
    input: Record<Key, Entry | null>,
    getCurrentEntry: (_state: typeof state, key: Key) => Entry | undefined = (s, k) => s[k]
) {
    const added = {} as Record<Key, Entry>;
    const removed = {} as Record<Key, Entry>;

    for (const key in input) {
        const incoming = input[key];
        const currentEntry = getCurrentEntry(state, key);

        if (incoming === null) {
            if (currentEntry !== undefined) {
                removed[key] = currentEntry;
            }
        } else {
            if (currentEntry !== incoming) {
                added[key] = incoming;
            }
        }
    }

    return { added, removed, hasChanges: !_.isEmpty(added) || !_.isEmpty(removed) };
}

// Regular table implementation (simplified)
export const table = <Entry, Key extends string | number | symbol = string | number | symbol>(
    initial: Record<Key, Entry> = {} as typeof initial
) => {

    const initialData = {} as Record<Key, Entry>;
    for (const key in initial) {
        initialData[key] = { ...initial[key] };
    }

    const gadget = defGadget<TableSpec<Key, Entry>>(
        (state, input) => {
            const { added, removed, hasChanges } = detectTableChanges(state, input);

            if (!hasChanges) {
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

export const cellTable = <Key extends string, S extends Omit<CellSpec<unknown, unknown, unknown>, 'actions'>>(
    initial: Record<Key, TappableGadget<S>> = {} as typeof initial
) => {
    type Spec = CellTableSpec<Key, S>;

    const gadget = defGadget<Spec>(
        (state, input) => {
            const { added, removed, hasChanges } = detectTableChanges(
                state.cells,
                input,
            );

            if (!hasChanges) {
                return { ignore: {} };
            }
            return { merge: { added, removed } };
        },
        {
            merge: (gadget, { added, removed }) => {
                const state = gadget.current();
                const newCells = { ...state.cells };
                const newCleanups = { ...state.cleanups };

                // Remove cells and clean up taps
                for (const key in removed) {
                    const cleanup = newCleanups[key];
                    cleanup?.();
                    delete newCleanups[key];
                    delete newCells[key];
                }

                // Add cells and set up taps
                for (const key in added) {
                    const cell = added[key];

                    // Tap into the cell to emit cellChanged events
                    const cleanup = cell.tap(({ changed }) => {
                        if (changed !== undefined) {
                            gadget.emit({ cellChanged: { [key]: cell } } as Spec['effects']);
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
    )({ cells: initial, cleanups: {} } as Spec['state']);
    return withTaps(gadget);
};

export const derive = <
    Key extends string | number | symbol,
    Source,
    Derived
>(
    source: TypedGadget<TableSpec<Key, Source>> & Tappable<TableSpec<Key, Source>['effects']>,
    transform: (key: Key, value: Source) => [Key, Derived | null]
) => {
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

    source.tap(({ added, removed }) => {
        const updates = {} as Record<Key, Derived | null>;

        if (added) {
            for (const key in added) {
                const [derivedKey, value] = transform(key, added[key]);
                updates[derivedKey] = value;
            }
        }

        if (removed) {
            for (const key in removed) {
                // Note: This assumes key mapping is stable for removals
                updates[key as Key] = null;
            }
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates);
        }
    });

    return derived;
};

// Cell table derivation that responds to cell changes!
export const cellDerive = <
    Key extends string | number | symbol,
    S extends Omit<CellSpec<unknown, unknown, unknown>, 'actions'>,
    Derived
>(
    source: TypedGadget<CellTableSpec<Key, S>> & Tappable<CellTableSpec<Key, S>['effects']>,
    transform: (key: Key, cellValue: S['state']) => [Key, Derived | null]
) => {
    // Compute initial state from current cell values
    const initial = {} as Record<Key, Derived>;
    const currentCells = source.current().cells;

    for (const key in currentCells) {
        const cell = currentCells[key];
        const cellValue = cell?.current();
        const [derivedKey, derivedValue] = transform(key, cellValue);
        if (derivedValue !== null) {
            initial[derivedKey] = derivedValue;
        }
    }

    const derived = withTaps(table<Derived>(initial));

    // Wire to both structural changes AND cell value changes
    source.tap(({ cellChanged, added, removed }) => {
        const updates = {} as Record<Key, Derived | null>;

        // Handle individual cell changes (the key feature!)
        if (cellChanged) {
            for (const key in cellChanged) {
                const cell = cellChanged[key];
                const cellValue = cell.current();
                const [derivedKey, value] = transform(key, cellValue);
                updates[derivedKey] = value;
            }
        }

        // Handle structural changes
        if (added) {
            for (const key in added) {
                const cell = added[key];
                const cellValue = cell.current();
                const [derivedKey, value] = transform(key, cellValue);
                updates[derivedKey] = value;
            }
        }

        if (removed) {
            for (const key in removed) {
                updates[key] = null;
            }
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates);
        }
    });

    return derived;
};


export type TableSpec<Key extends string | number | symbol, Entry> = {
    state: Record<Key, Entry>;
    input: Record<Key, Entry | null>;
    actions: {
        merge: { added: Record<Key, Entry>; removed: Record<Key, Entry> };
        ignore: {};
    };
    effects: {
        changed: Record<Key, Entry>;
        added: Record<Key, Entry>;
        removed: Record<Key, Entry>;
        noop: {};
    };
};

export type CellTableSpec<Key extends string | number | symbol, S extends Omit<CellSpec<unknown, unknown, unknown>, 'actions'>> = {
    state: {
        cells: Record<Key, TappableGadget<S>>;
        cleanups: Record<Key, () => void>;
    };
    input: Record<Key, TappableGadget<S> | null>;
    actions: {
        merge: { added: Record<Key, TappableGadget<S>>; removed: Record<Key, TappableGadget<S>> };
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

// Usage example:

// const someCell = withTaps(lastMap({}));
// const anotherCell = withTaps(lastMap({}));

// const cellTable1 = cellTable<string, ExtractSpec<typeof someCell>>({
//     'cell1': someCell,
//     'cell2': anotherCell
// });

// // This will respond to individual cell changes!
// const derivedFromCells = cellDerive(cellTable1, (key, cellValue) => {
//     return [key, { ...cellValue, foo: 'bar' }];
// });

// cellTable1.tap(({ cellChanged }) => {
//     console.log('cellTable1', cellChanged);
// });

// derivedFromCells.tap(({ changed }) => {
//     console.log('derivedFromCells', changed);
// });

// someCell.receive({ a: 1 });
// anotherCell.receive({ a: 2 });

// // Now when someCellGadget.receive(newValue) is called,
// // the derivedFromCells will automatically update!