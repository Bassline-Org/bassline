import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { ExtractSpec, GadgetEffects, TypedGadget } from '../../core/types';
import { Tappable, withTaps, TappableGadget, ExtractEffect } from '../../semantics';
import { CellSpec } from '../specs';

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

export type TableHelpers<State, Input, Changes> = {
    setup: (initial: State) => State;
    detectChanges: (state: State, input: Input) => {
        added: Changes;
        removed: Changes;
        hasChanges: boolean;
    };
    handleAdd: <G>(newState: State, changes: Changes, gadget: G) => void;
    handleRemove: <G>(newState: State, changes: Changes, gadget: G) => void;
}

export type TableSpec<State, Input, Changes, ExtraEffects extends GadgetEffects = {}> = {
    state: State;
    input: Input;
    actions: {
        merge: { added: Changes; removed: Changes };
        ignore: {};
    };
    effects: {
        changed: State;
        added: Changes;
        removed: Changes;
        noop: {};
    } & ExtraEffects;
}

export type CellTableSpec<Spec extends CellSpec> = TableSpec<
    { cells: Record<string, TappableGadget<Spec>>; cleanups: Record<string, () => void> },
    Record<string, TappableGadget<Spec> | null>,
    Record<string, TappableGadget<Spec>>,
    { cellChanged: Record<string, TappableGadget<Spec>> }>;

export const defTable = <State, Input, Changes, ExtraEffects extends GadgetEffects = {}>(
    helpers: TableHelpers<State, Input, Changes>,
) => {
    return (initial: State) => {
        const initialData = helpers.setup(initial);

        type Spec = TableSpec<State, Input, Changes, ExtraEffects>;

        const gadget = withTaps(defGadget<Spec>(
            (state, input) => {
                const { added, removed, hasChanges } = helpers.detectChanges(state, input);

                if (hasChanges) {
                    return { merge: { added, removed } };
                }
                return { ignore: {} };
            },
            {
                merge: (gadget, { added, removed }) => {
                    const newState = _.cloneDeep(gadget.current());

                    helpers.handleAdd(newState, added, gadget);
                    helpers.handleRemove(newState, removed, gadget);

                    gadget.update(newState);
                    return { changed: newState, added, removed } as Partial<Spec['effects']> & ExtraEffects;
                },
                ignore: () => ({ noop: {} }) as Partial<Spec['effects']> & ExtraEffects
            }
        )(initialData));

        return withTaps(gadget);
    }
};

export const handleAdd = <K extends keyof any, V, G>(newState: Record<K, V>, changes: Record<K, V | null>) => {
    for (const key in changes) {
        if (changes[key] !== null) {
            newState[key] = changes[key];
        }
    }
}

export const handleRemove = <K extends keyof any, V, G>(newState: Record<K, V>, changes: Record<K, V | null>) => {
    for (const key in changes) {
        delete newState[key];
    }
}

export const detectChanges = <K extends keyof any, V, G>(state: Record<K, V>, input: Record<K, V | null>) => {
    return detectTableChanges(state, input);
}

export const setup = <T>(initial: T) => initial;


export const lastTable = <K extends keyof any, V>(initial: Record<K, V>) => {
    type State = Record<K, V>;
    type Input = Record<K, V | null>;
    type Changes = Record<K, V>;

    return defTable<State, Input, Changes>({
        setup: (initial: Input) => initial as State,
        detectChanges,
        handleAdd,
        handleRemove,
    })(initial);
}

export const firstTable = <K extends keyof any, V>(initial: Record<K, V>) => {
    type State = Record<K, V>;
    type Input = Record<K, V | null>;
    type Changes = Record<K, V>;

    return defTable<State, Input, Changes>({
        setup,
        detectChanges,
        handleAdd: (newState, changes) => {
            for (const key in changes) {
                const existing = newState[key];
                if (existing === undefined) {
                    newState[key] = changes[key]!;
                }
            }
        },
        handleRemove,
    })(initial);
}

export const cellTable = <Key extends string, Spec extends CellSpec>(
    initial: Record<Key, TappableGadget<Spec>> = {} as Record<Key, TappableGadget<Spec>>
) => {
    type State = { cells: Record<Key, TappableGadget<Spec>>; cleanups: Record<Key, () => void> };
    type Input = Record<Key, TappableGadget<Spec> | null>;
    type Changes = State['cells']
    type ExtraEffects = { cellChanged: State['cells'] };

    const gadget = defTable<State, Input, Changes, ExtraEffects>({
        setup: (input) => {
            return { cells: {}, cleanups: {} } as State;
        },

        detectChanges: (state, input) =>
            detectTableChanges(state.cells, input),

        handleAdd: (state, changes) => {
            for (const key in changes) {
                const cell = changes[key];
                // Set up tap for cellChanged events
                const cleanup = cell.tap(({ changed }) => {
                    if (changed !== undefined) {
                        gadget.emit({ cellChanged: { [key]: cell } as Record<Key, TappableGadget<Spec>> });
                    }
                });

                state.cells[key] = cell;
                state.cleanups[key] = cleanup;
            }
        },

        handleRemove: (state, changes) => {
            for (const key in changes) {
                state.cleanups[key]?.();
                delete state.cleanups[key];
                delete state.cells[key];
            }
        }
    })({ cells: {}, cleanups: {} } as State);
    gadget.receive(initial);
    return gadget;
}

export const derive = <Key extends string | number | symbol, Source, Derived>(
    source: TypedGadget<TableSpec<Record<Key, Source>, Record<Key, Source | null>, Record<Key, Source>>> &
        Tappable<TableSpec<Record<Key, Source>, Record<Key, Source | null>, Record<Key, Source>>['effects']>,
    transform: (key: Key, value: Source) => [Key, Derived | null],
) => {
    // Initialize with current source values
    const initial = {} as Record<Key, Derived>;
    const currentSource = source.current();

    for (const key in currentSource) {
        const value = currentSource[key];
        const [derivedKey, derivedValue] = transform(key, value);
        if (derivedValue !== null) {
            initial[derivedKey] = derivedValue;
        }
    }

    const derived = lastTable(initial);

    // Wire up reactive updates
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
                // Assumes key mapping is stable for removals
                updates[key] = null;
            }
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates);
        }
    });

    return derived;
};

export const cellDerive = <Key extends keyof any, Spec extends CellSpec, Derived>(
    source: TappableGadget<CellTableSpec<Spec>>,
    transform: (key: Key, cellValue: Spec['state']) => [Key, Derived | null],
) => {
    // Compute initial state from current cell values
    const initial = {} as Record<Key, Derived>;
    const currentCells = source.current().cells;

    for (const key in currentCells) {
        const cell = currentCells[key];
        if (cell) {
            const cellValue = cell.current();
            const [derivedKey, derivedValue] = transform(key as Key, cellValue);
            if (derivedValue !== null) {
                initial[derivedKey] = derivedValue;
            }
        }
    }

    const derived = lastTable(initial);

    // Wire to both structural changes AND cell value changes
    source.tap(({ cellChanged, added, removed }) => {
        const updates = {} as Record<Key, Derived | null>;

        // Handle individual cell changes (the key feature!)
        if (cellChanged) {
            _.entries(cellChanged).forEach(([key, cell]) => {
                const cellValue = cell.current();
                const [derivedKey, value] = transform(key as Key, cellValue);
                updates[derivedKey] = value;
            });
        }

        // Handle structural changes
        if (added) {
            _.entries(added).forEach(([key, cell]) => {
                const cellValue = cell.current();
                const [derivedKey, value] = transform(key as Key, cellValue);
                updates[derivedKey] = value;
            });
        }

        if (removed) {
            _.entries(removed).forEach(([key]) => {
                updates[key as Key] = null;
            });
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates as Record<Key, Derived>);
        }
    });

    return derived;
};

const a = lastTable<string, number>({
    a: 1,
    b: 2,
    c: 3
});

const derivedA = derive(a, (key, value) => [key, value * 2]);

const b = lastTable<string, string>({
    foo: 'a',
    bar: 'b',
    baz: 'c'
});

const cellT = cellTable<string, CellSpec<Record<string, any>>>({
    a,
    b
});

const derivedFromCellT = cellDerive(cellT, (key, value) => [key, _.entries(value).reduce((acc, [key, value]) => _.isNumber(value) ? acc + value : acc, 0)]);

console.log(derivedFromCellT.current());

derivedFromCellT.tap(({ changed }) => {
    if (changed) {
        console.log('changed', _.keys(changed));
    }
});

cellT.tap(({ cellChanged, added, removed }) => {
    if (cellChanged) {
        console.log('cellChanged', _.keys(cellChanged));
    }
    if (added) {
        console.log('added', _.keys(added));
    }
    if (removed) {
        console.log('removed', _.keys(removed));
    }
});

a.receive({
    a: 4,
    b: 5,
    c: 6
});

a.receive({
    a: null,
    d: 10
})

b.receive({
    foo: 'd',
    baz: 'e'
})

cellT.receive({
    a: null,
});

console.log(derivedA.current());
console.log(derivedFromCellT.current());