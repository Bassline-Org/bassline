import _ from 'lodash';
import { Actions, defGadget, derive, Effects, Gadget, Input, Methods, State, withTaps } from '../../core/typed';
import { maxCell } from './typed-cells';

export type TableSpec<K extends PropertyKey, V> =
    & State<Record<K, V>>
    & Input<Record<K, V | null>>
    & Actions<{
        merge: { added: Record<K, V>; removed: Record<K, V> };
        ignore: {};
    }>
    & Effects<{
        changed: Record<K, V>;
        added: Record<K, V>;
        removed: Record<K, V>;
        noop: {};
    }>;

export function tableMethods<K extends PropertyKey, V>(): Methods<TableSpec<K, V>> {
    return {
        merge: (gadget, { added, removed }) => {
            const current = gadget.current();
            const next = { ...current };
            for (const key in removed) {
                delete next[key];
            }
            for (const key in added) {
                next[key] = added[key];
            }
            gadget.update(next);
            return {
                changed: next,
                added,
                removed
            };
        },

        ignore: () => ({ noop: {} })
    };
}

const getTableChanges = <K extends PropertyKey, V>(state: Record<K, V>, input: Record<K, V | null>) => {
    const added: Record<K, V> = {} as Record<K, V>;
    const removed: Record<K, V> = {} as Record<K, V>;
    for (const key in input) {
        const value = input[key];
        if (value === null) {
            if (state[key] !== undefined) {
                removed[key] = state[key];
            }
        } else {
            if (state[key] !== value) {
                added[key] = value;
            }
        }
    }
    return { added, removed, hasChanges: _.keys(added).length > 0 || _.keys(removed).length > 0 };
}

export const lastTable = <K extends PropertyKey, V>(initial: Record<K, V>) => defGadget<TableSpec<K, V>>({
    dispatch: (state, input) => {
        const { added, removed, hasChanges } = getTableChanges(state, input);
        return hasChanges ? { merge: { added, removed } } : { ignore: {} };
    },
    methods: tableMethods()
})(initial);

export const firstTable = <K extends PropertyKey, V>(initial: Record<K, V>) => {
    return defGadget<TableSpec<K, V>>({
        dispatch: (state, input) => {
            const { added, removed, hasChanges } = getTableChanges(state, input);
            return hasChanges ? { merge: { added, removed } } : { ignore: {} };
        },
        methods: {
            ...tableMethods(),
            merge: (gadget, { added, removed }) => {
                const current = { ...gadget.current() };
                const toAdd = {} as Record<K, V>;
                for (const key in removed) {
                    delete current[key];
                }
                for (const key in added) {
                    if (current[key] === undefined) {
                        toAdd[key] = added[key];
                    }
                }
                gadget.update({ ...current, ...toAdd });
                return {
                    changed: { ...current, ...toAdd },
                    added: toAdd,
                    removed
                };
            }
        }
    })(initial);
}

export const unionTable = <K extends PropertyKey, V>(initial: Record<K, Set<V>>) => {
    return defGadget<TableSpec<K, Set<V>>>({
        dispatch: (state, input) => {
            const added = {} as Record<K, Set<V>>;
            const removed = {} as Record<K, Set<V>>;
            for (const key in input) {
                const value = input[key];
                if (value === null) {
                    if (state[key] !== undefined) {
                        removed[key] = state[key];
                    }
                } else {
                    const stateValue = state[key] ?? new Set<V>();
                    const union = stateValue.union(value);
                    if (union.size !== stateValue.size) {
                        added[key] = value;
                    }
                }
            }
            const hasChanges = _.keys(added).length > 0 || _.keys(removed).length > 0;
            return hasChanges ? { merge: { added, removed } } : { ignore: {} };
        },
        methods: {
            ...tableMethods(),
            merge: (gadget, { added, removed }) => {
                const current = { ...gadget.current() };
                const toAdd = {} as Record<K, Set<V>>;
                for (const key in removed) {
                    current[key] = current[key].difference(removed[key]);
                }
                for (const key in added) {
                    if (current[key] === undefined) {
                        toAdd[key] = added[key];
                    } else {
                        toAdd[key] = current[key].union(added[key]);
                    };
                }
                gadget.update({ ...current, ...toAdd });
                return {
                    changed: { ...current, ...toAdd },
                    added: toAdd,
                    removed
                };
            }
        }
    })(initial);
}

export type FamilyTableSpec<K extends PropertyKey, G> =
    & State<Record<K, G>>
    & Input<{
        send: {
            [key in K]: Input<G>;
        },
        create: {
            [key in K]: State<G>;
        },
        delete: K,
        clear: true,
    }[]>
    & Actions<{
        merge: { added: Record<K, G>; removed: Record<K, G>; cleared: boolean };
        ignore: {};
    }>
    & Effects<{
        changed: Record<K, G>;
        added: Record<K, G>;
        removed: Record<K, G>;
        received: Record<K, State<G>>;
        noop: {};
    }>;

export const defFamilyTable = <K extends PropertyKey, G>(factory: () => G extends Gadget<infer S> ? G : never) => {
    return defGadget<FamilyTableSpec<K, G>>({
        dispatch: (state, input) => {
            const added = {} as Record<K, G>;
            const removed = {} as Record<K, G>;
            let cleared = false;
            const received = {} as Record<K, Input<G>>;
            for (const message of input) {
                if (message.send) {
                    for (const key in message.send) {
                        received[key] = message.send[key];
                    }
                }
                if (message.create) {
                    for (const key in message.create) {
                        if (state[key] === undefined) {
                            added[key] = factory();
                        }
                    }
                }
                if (message.delete) {
                    removed[message.delete] = state[message.delete];
                }
                if (message.clear) {
                    cleared = true;
                }
            }
            const hasChanges = _.keys(added).length > 0 || _.keys(removed).length > 0 || cleared;
            return hasChanges ? { merge: { added, removed, cleared } } : { ignore: {} };
        },
        methods: {
            merge: (gadget, { added, removed, cleared }) => {
                const current = { ...gadget.current() };
                for (const key in removed) {
                    delete current[key];
                }
                for (const key in added) {
                    current[key] = added[key];
                }
                gadget.update({ ...current, ...added });
                return {
                    changed: { ...current, ...added },
                    added,
                    removed,
                    cleared
                };
            },
            ignore: () => ({ noop: {} })
        }
    })({} as Record<K, G>);
}

const maxFamilyFn = () => withTaps(maxCell(0));
const maxFamily = defFamilyTable(maxFamilyFn);

const a = withTaps(lastTable<string, number>({
    a: 1,
    b: 2,
    c: 3
}));

const b = withTaps(firstTable<string, string>({
    foo: 'a',
    bar: 'b',
    baz: 'c'
}));

const c = withTaps(unionTable<string, number>({
    foo: new Set([1]),
    bar: new Set([2]),
    baz: new Set([3])
}));

const derived = derive(c, entries => Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, Array.from(value).reduce((acc, x) => acc + x, 0)])));

derived.tap(({ changed }) => {
    if (changed) {
        console.log('Derived changed to:', changed);
    }
});

c.tap(({ changed }) => {
    if (changed) {
        console.log('Changed to:', changed);
    }
});

c.receive({
    foo: new Set([1, 2, 3, 4]),
    bar: new Set([2, 3, 4, 5]),
    baz: new Set([3, 4, 5, 6])
});

c.receive({
    foo: new Set([1, 2, 3, 4]),
    bar: new Set([2, 3, 4, 5]),
    baz: new Set([3, 4, 5, 6])
});

c.receive({
    foo: null,
    bar: null,
    baz: null
});