import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { ExtractSpec, TypedGadget, GadgetEffects, PartialSpec } from '../../core/types';
import { Tappable, withTaps, TappableGadget } from '../../semantics';
import { CellSpec } from '../specs';

// ============================================
// Core Table Types
// ============================================

export type TableSpec<
    State,
    Input,
    Changes,
    ExtraEffects extends GadgetEffects = {}
> = {
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
};

export type TableHelpers<State, Input, Changes> = {
    setup: (initial: State) => State;
    detectChanges: (state: State, input: Input) => {
        added: Changes;
        removed: Changes;
        hasChanges: boolean;
    };
    handleAdd: <G extends TypedGadget<TableSpec<State, Input, Changes>>>(
        newState: State,
        changes: Changes,
        gadget: G
    ) => void;
    handleRemove: <G extends TypedGadget<TableSpec<State, Input, Changes>>>(
        newState: State,
        changes: Changes,
        gadget: G
    ) => void;
};

// ============================================
// Generic Helpers with Proper Types
// ============================================

function detectChanges<
    Key extends PropertyKey,
    Entry
>(
    state: Record<Key, Entry>,
    input: Record<Key, Entry | null>
): {
    added: Record<Key, Entry>;
    removed: Record<Key, Entry>;
    hasChanges: boolean;
} {
    const added = {} as Record<Key, Entry>;
    const removed = {} as Record<Key, Entry>;

    for (const key in input) {
        const incoming = input[key];
        const current = state[key];

        if (incoming === null) {
            if (current !== undefined) {
                removed[key] = current;
            }
        } else if (current !== incoming) {
            added[key] = incoming;
        }
    }

    return {
        added,
        removed,
        hasChanges: !_.isEmpty(added) || !_.isEmpty(removed)
    };
}

function handleAdd<Key extends PropertyKey, Value>(
    newState: Record<Key, Value>,
    changes: Record<Key, Value>
): void {
    for (const key in changes) {
        newState[key] = changes[key];
    }
}

function handleRemove<Key extends PropertyKey, Value>(
    newState: Record<Key, Value>,
    changes: Record<Key, Value>
): void {
    for (const key in changes) {
        delete newState[key];
    }
}

// ============================================
// Base Table Factory
// ============================================

export function defTable<
    State,
    Input,
    Changes,
    ExtraEffects extends GadgetEffects = {}
>(
    helpers: TableHelpers<State, Input, Changes>
) {
    return (initial: State): TappableGadget<TableSpec<State, Input, Changes, ExtraEffects>> &
        Tappable<TableSpec<State, Input, Changes, ExtraEffects>['effects']> => {

        type Spec = TableSpec<State, Input, Changes, ExtraEffects>;
        type AllEffects = Spec['effects'];

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

                    const effects: AllEffects = {
                        changed: newState,
                        added,
                        removed,
                        noop: {}
                    } as AllEffects;

                    return effects;
                },
                ignore: () => ({ noop: {} } as AllEffects)
            }
        )(helpers.setup(initial)));

        return gadget;
    };
}

// ============================================
// Concrete Table Implementations
// ============================================

export function lastTable<
    Key extends PropertyKey,
    Value
>(initial: Record<Key, Value>) {
    type State = Record<Key, Value>;
    type Input = Record<Key, Value | null>;

    return defTable<State, Input, State>({
        setup: (x: State) => x,
        detectChanges,
        handleAdd,
        handleRemove,
    })(initial);
}

export function firstTable<
    Key extends PropertyKey,
    Value
>(initial: Record<Key, Value>) {
    type State = Record<Key, Value>;
    type Input = Record<Key, Value | null>;

    return defTable<State, Input, State>({
        setup: (x: State) => x,
        detectChanges,
        handleAdd: (newState: State, changes: State) => {
            for (const key in changes) {
                if (newState[key] === undefined) {
                    newState[key] = changes[key];
                }
            }
        },
        handleRemove,
    })(initial);
}

// ============================================
// Cell Table
// ============================================

function ensureTappable<Spec extends PartialSpec>(
    gadget: TypedGadget<Spec>
): TappableGadget<Spec> {
    if ('tap' in gadget && typeof (gadget as TappableGadget<Spec>).tap === 'function') {
        return gadget as TappableGadget<Spec>;
    }
    return withTaps(gadget) as TappableGadget<Spec>;
}

export type CellTableState<Key extends string, Spec extends CellSpec> = {
    cells: Record<Key, TappableGadget<Spec>>;
    cleanups: Record<Key, () => void>;
};

export type CellTableInput<Key extends string, Spec extends CellSpec> =
    Record<Key, TypedGadget<Spec> | null>;

export type CellTableChanges<Key extends string, Spec extends CellSpec> =
    Record<Key, TappableGadget<Spec>>;

export type CellTableEffects<Key extends string, Spec extends CellSpec> = {
    cellChanged: Record<Key, TappableGadget<Spec>>;
};

export function cellTable<
    Key extends string,
    Spec extends CellSpec
>(
    initial: Record<Key, TypedGadget<Spec>> = {} as Record<Key, TypedGadget<Spec>>
) {
    type State = CellTableState<Key, Spec>;
    type Input = CellTableInput<Key, Spec>;
    type Changes = CellTableChanges<Key, Spec>;
    type ExtraEffects = CellTableEffects<Key, Spec>;

    const gadget = defTable<State, Input, Changes, ExtraEffects>({
        setup: (): State => ({
            cells: {} as Record<Key, TappableGadget<Spec>>,
            cleanups: {} as Record<Key, () => void>
        }),

        detectChanges: (state: State, input: Input) => {
            const tappableInput: Record<Key, TappableGadget<Spec> | null> =
                {} as Record<Key, TappableGadget<Spec> | null>;

            for (const key in input) {
                const value = input[key];
                tappableInput[key] = value === null ? null : ensureTappable(value);
            }

            return detectChanges(state.cells, tappableInput);
        },

        handleAdd: (state: State, changes: Changes) => {
            for (const key in changes) {
                const cell = changes[key];
                const cleanup = cell.tap((effect: Spec['effects']) => {
                    if ('changed' in effect && effect.changed !== undefined) {
                        const cellChangedEffect: Record<Key, TappableGadget<Spec>> =
                            { [key]: cell } as Record<Key, TappableGadget<Spec>>;
                        gadget.emit({ cellChanged: cellChangedEffect });
                    }
                });
                state.cells[key] = cell;
                state.cleanups[key] = cleanup;
            }
        },

        handleRemove: (state: State, changes: Changes) => {
            for (const key in changes) {
                const cleanup = state.cleanups[key];
                if (cleanup) cleanup();
                delete state.cleanups[key];
                delete state.cells[key];
            }
        }
    })({
        cells: {} as Record<Key, TappableGadget<Spec>>,
        cleanups: {} as Record<Key, () => void>
    });

    if (initial && Object.keys(initial).length > 0) {
        gadget.receive(initial);
    }

    return gadget;
}

// ============================================
// Derivation System with Full Type Safety
// ============================================

export function deriveTable<
    SourceKey extends PropertyKey,
    SourceValue,
    DerivedValue
>(
    source: TypedGadget<TableSpec<Record<SourceKey, SourceValue>, Record<SourceKey, SourceValue | null>, Record<SourceKey, SourceValue>>> &
        Tappable<TableSpec<Record<SourceKey, SourceValue>, Record<SourceKey, SourceValue | null>, Record<SourceKey, SourceValue>>['effects']>,
    transform: (key: SourceKey, value: SourceValue) => DerivedValue | null
): TypedGadget<TableSpec<Record<SourceKey, DerivedValue>, Record<SourceKey, DerivedValue | null>, Record<SourceKey, DerivedValue>>> &
    Tappable<TableSpec<Record<SourceKey, DerivedValue>, Record<SourceKey, DerivedValue | null>, Record<SourceKey, DerivedValue>>['effects']> {

    const sourceState = source.current();
    const initial: Record<SourceKey, DerivedValue> = {} as Record<SourceKey, DerivedValue>;

    for (const key in sourceState) {
        const transformed = transform(key, sourceState[key]);
        if (transformed !== null) {
            initial[key] = transformed;
        }
    }

    const derived = lastTable(initial);

    source.tap((effects) => {
        const updates: Record<SourceKey, DerivedValue | null> = {} as Record<SourceKey, DerivedValue | null>;

        if ('added' in effects && effects.added) {
            const added = effects.added as Record<SourceKey, SourceValue>;
            for (const key in added) {
                updates[key] = transform(key, added[key]);
            }
        }

        if ('removed' in effects && effects.removed) {
            const removed = effects.removed as Record<SourceKey, SourceValue>;
            for (const key in removed) {
                updates[key] = null;
            }
        }

        if ('changed' in effects && effects.changed) {
            const changed = effects.changed as Record<SourceKey, SourceValue>;
            for (const key in changed) {
                updates[key] = transform(key, changed[key]);
            }
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates);
        }
    });

    return derived;
}

// Helper type for CellTable spec
type CellTableSpec<K extends string, S extends CellSpec> = TableSpec<
    CellTableState<K, S>,
    CellTableInput<K, S>,
    CellTableChanges<K, S>,
    CellTableEffects<K, S>
>;

export function deriveCellValues<
    Key extends string,
    Spec extends CellSpec
>(
    cellTableGadget: TypedGadget<CellTableSpec<Key, Spec>> &
        Tappable<CellTableSpec<Key, Spec>['effects']>
): TypedGadget<TableSpec<Record<Key, Spec['state']>, Record<Key, Spec['state'] | null>, Record<Key, Spec['state']>>> &
    Tappable<TableSpec<Record<Key, Spec['state']>, Record<Key, Spec['state'] | null>, Record<Key, Spec['state']>>['effects']> {

    type Value = Spec['state'];

    const cells = cellTableGadget.current().cells;
    const initial: Record<Key, Value> = {} as Record<Key, Value>;

    for (const key in cells) {
        const cell = cells[key];
        if (cell) {
            initial[key] = cell.current();
        }
    }

    const derived = lastTable(initial);

    cellTableGadget.tap((effects) => {
        const updates: Record<Key, Value | null> = {} as Record<Key, Value | null>;

        if ('cellChanged' in effects && effects.cellChanged) {
            for (const key in effects.cellChanged) {
                const cell = effects.cellChanged[key];
                if (cell) {
                    updates[key] = cell.current();
                }
            }
        }

        if ('added' in effects && effects.added) {
            for (const key in effects.added) {
                const cell = effects.added[key];
                if (cell) {
                    updates[key] = cell.current();
                }
            }
        }

        if ('removed' in effects && effects.removed) {
            for (const key in effects.removed) {
                updates[key] = null;
            }
        }

        if (!_.isEmpty(updates)) {
            derived.receive(updates);
        }
    });

    return derived;
}

// ============================================
// Fluent Derivation Builder
// ============================================

export class DerivationBuilder<
    SourceKey extends PropertyKey,
    SourceValue
> {
    constructor(
        private source: TypedGadget<TableSpec<Record<SourceKey, SourceValue>, Record<SourceKey, SourceValue | null>, Record<SourceKey, SourceValue>>> &
            Tappable<TableSpec<Record<SourceKey, SourceValue>, Record<SourceKey, SourceValue | null>, Record<SourceKey, SourceValue>>['effects']>
    ) { }

    map<DerivedValue>(
        transform: (key: SourceKey, value: SourceValue) => DerivedValue | null
    ): DerivationBuilder<SourceKey, DerivedValue> {
        const derived = deriveTable(this.source, transform);
        return new DerivationBuilder(derived);
    }

    filter(
        predicate: (key: SourceKey, value: SourceValue) => boolean
    ): DerivationBuilder<SourceKey, SourceValue> {
        const transform = (k: SourceKey, v: SourceValue): SourceValue | null =>
            predicate(k, v) ? v : null;
        return this.map(transform);
    }

    reduce<Result>(
        reducer: (acc: Result, key: SourceKey, value: SourceValue) => Result,
        initial: Result
    ): TypedGadget<CellSpec<Result, Result>> & Tappable<CellSpec<Result, Result>['effects']> {
        const derived = withTaps(lastCell(initial));

        const compute = () => {
            const sourceState = this.source.current();
            let result = initial;
            for (const key in sourceState) {
                result = reducer(result, key, sourceState[key]);
            }
            return result;
        };

        // Initial computation
        derived.receive(compute());

        // Update on changes
        this.source.tap(() => {
            derived.receive(compute());
        });

        return derived;
    }

    build() {
        return this.source;
    }
}

export function derive<
    Key extends PropertyKey,
    Value
>(
    source: TypedGadget<TableSpec<Record<Key, Value>, Record<Key, Value | null>, Record<Key, Value>>> &
        Tappable<TableSpec<Record<Key, Value>, Record<Key, Value | null>, Record<Key, Value>>['effects']>
) {
    return new DerivationBuilder(source);
}