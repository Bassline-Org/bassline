import _ from 'lodash';
import { Actions, defGadget, derive, Effects, Gadget, Input, InputOf, Methods, SpecOf, State, Tappable, withTaps } from '../../core/typed';
import { maxCell } from './typed-cells';

export type TableSpec<K extends PropertyKey, V> =
    & State<Record<K, V>>
    & Input<Partial<Record<K, V | null>>>
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

const getTableChanges = <K extends PropertyKey, V>(state: Record<K, V>, input: Partial<Record<K, V | null>>) => {
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
                added[key] = value as V;
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
                    const union = stateValue.union(value as Set<V>);
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

export type FamilyTableSpec<K extends PropertyKey, G extends Gadget> =
    & State<Record<K, G>>
    & Input<Partial<{
        send: Record<K, InputOf<SpecOf<G>>>,
        create: K[],
        delete: K[],
        clear: true,
    }>>
    & Actions<{
        merge: { added: Record<K, G>; removed: Record<K, G>; received: Record<K, InputOf<SpecOf<G>>>; cleared: boolean };
        ignore: {};
    }>
    & Effects<{
        changed: Record<K, G>;
        added: Record<K, G>;
        removed: Record<K, G>;
        received: Record<K, InputOf<SpecOf<G>>>;
        noop: {};
    }>;

export const defFamilyTable = <G extends Gadget, K extends PropertyKey = PropertyKey>(factory: () => G) => {
    return defGadget<FamilyTableSpec<K, G>>({
        dispatch: (state, input) => {
            const added = {} as Record<K, G>;
            const removed = {} as Record<K, G>;
            let cleared = false;
            const received = {} as Record<K, InputOf<SpecOf<G>>>;
            if (input.send) {
                for (const key in input.send) {
                    received[key] = input.send[key];
                }
            }
            if (input.create) {
                for (const i in input.create) {
                    const key = input.create[i]!;
                    if (state[key] === undefined) {
                        added[key] = factory();
                    }
                }
            }
            if (input.delete) {
                for (const key in input.delete) {
                    removed[key] = state[key];
                }
            }
            if (input.clear) {
                cleared = true;
            }
            const hasChanges = _.keys(added).length > 0 || _.keys(removed).length > 0 || cleared;
            return hasChanges ? { merge: { added, removed, received, cleared } } : { ignore: {} };
        },
        methods: {
            merge: (gadget, { added, removed, received, cleared }) => {
                const current = { ...gadget.current() };
                for (const key in added) {
                    current[key] = added[key];
                }
                for (const key in removed) {
                    delete current[key];
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

const maxFamily = withTaps(defFamilyTable(() => withTaps(maxCell(0))));
maxFamily.tap(({ added, removed, received }) => {
    if (added) {
        console.log('Added:', added);
    }
    if (removed) {
        console.log('Removed:', removed);
    }
    if (received) {
        console.log('Received:', received);
    }
});
maxFamily.receive({
    create: ['a', 'b', 'c'],
    send: {
        a: 10,
        b: 20,
        c: 30
    },
    delete: ['b']
});

const fromFamily = maxFamily.current()['a']!;
fromFamily.tap(({ changed }) => {
    if (changed) {
        console.log('From family changed to:', changed);
    }
});
fromFamily.receive(20);
console.log(fromFamily.current());