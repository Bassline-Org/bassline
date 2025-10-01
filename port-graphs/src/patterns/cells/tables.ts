import _ from 'lodash';
import { Actions, defGadget, derive, Effects, EffectsOf, Gadget, Input, InputOf, Methods, SpecOf, State, Tappable, withTaps } from '../../core/context';
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

export function tableMethods<K extends PropertyKey, V>(): Methods<Gadget<TableSpec<K, V>>> {
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
        return hasChanges ? ['merge', { added, removed }] : ['ignore', {}];
    },
    methods: tableMethods()
})(initial);

export const firstTable = <K extends PropertyKey, V>(initial: Record<K, V>) => {
    return defGadget<TableSpec<K, V>>({
        dispatch: (state, input) => {
            const { added, removed, hasChanges } = getTableChanges(state, input);
            return hasChanges ? ['merge', { added, removed }] : ['ignore', {}];
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
            return hasChanges ? ['merge', { added, removed }] : ['ignore', {}];
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

type CommandInput<K extends keyof C, C> = [K, C[K]]
type Commands<C extends Record<PropertyKey, unknown>> =
    | Input<CommandInput<keyof C, C>>
    & Actions<C>

export type FamilyTableSpec<K extends PropertyKey, G extends Gadget> =
    & State<Record<K, G>>
    & Commands<{
        send: Record<K, InputOf<SpecOf<G>>>;
        create: K[];
        delete: K[];
        clear: true;
    }>
    & Effects<{
        changed: Record<K, G>;
        added: Record<K, G>;
        removed: Record<K, G>;
        received: Record<K, InputOf<SpecOf<G>>>;
        noop: {};
    }>;

type Fam = FamilyTableSpec<string, Gadget<TableSpec<string, number>>>;
type FamGadget = Gadget<Fam>;
type FamMethods = Methods<FamGadget>;

export const defFamilyTable = <G extends Gadget, K extends PropertyKey = PropertyKey>(factory: () => G) => {
    return defGadget<FamilyTableSpec<K, G>>({
        dispatch: (state, [action, context]) => {
            return [action, context];
        },
        methods: {
            send: (gadget, sends) => {
                const current = gadget.current();
                for (const [key, value] of Object.entries<InputOf<SpecOf<G>>>(sends)) {
                    const gadget = current[key as K]!;
                    gadget.receive(value);
                }
                return { received: sends };
            },
            create: (gadget, keys) => {
                const current = gadget.current();
                const added = {} as Record<K, G>;
                for (const key of keys) {
                    if (current[key as K] === undefined) {
                        added[key as K] = factory();
                    }
                }
                gadget.update({ ...current, ...added });
                return { added };
            },
            delete: (gadget, keys) => {
                const current = gadget.current();
                const removed = {} as Record<K, G>;
                for (const key of keys) {
                    if (current[key as K] !== undefined) {
                        removed[key as K] = current[key as K];
                    }
                }
                return { removed };
            },
            clear: (gadget) => {
                const current = gadget.current();
                for (const key in current) {
                    delete current[key as K];
                }
                gadget.update({} as Record<K, G>);
                return { removed: current };
            },
        }
    })({} as Record<K, G>);
}