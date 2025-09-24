import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { CellSpec } from '../specs';
import { ExtractSpec, TypedGadget } from '../../core/types';
import { withTaps } from '../../semantics';
import { lastMap } from './typed-maps';

export type TableSpec<Key extends string = string, Row = unknown> = CellSpec<
    Record<Key, Row>,
    Record<Key, Row | null>,
    {
        added: Record<Key, Row>;
        removed: Record<Key, Row>;
    }
> & {
    effects: {
        // The changed effect is the full table state
        changed: Record<Key, Row>;
        // Added rows
        added: Record<Key, Row>;
        // Removed rows
        removed: Record<Key, Row>;
    };
};

export const tableCell = <Key extends string = string, Row = unknown>(initial: Record<Key, Row>) => {
    return defGadget<TableSpec<Key, Row>>(
        (state, input) => {
            const changes = {
                added: {} as Record<Key, Row>,
                removed: {} as Record<Key, Row>,
            };

            for (const key in input) {
                const incoming = input[key];
                const existing = state[key];

                if (incoming === null) {
                    if (existing !== undefined) {
                        changes.removed[key] = existing;
                    }
                } else if (incoming !== undefined) {
                    changes.added[key] = incoming;
                }
            }

            if (_.isEmpty(changes.added) && _.isEmpty(changes.removed)) {
                return { ignore: {} };
            }

            return { merge: changes };
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
    )(initial as Record<Key, Row>);
};

export type TableViewState<Source extends TableSpec, Derived> = {
    fn: (source: Source['state'][keyof Source['state']]) => Derived;
    derived: Derived;
}

export type TableViewSpec<Key extends string, Source, Derived> = {
    state: Record<Key, Derived>;
    input: {
        added?: Record<Key, Source>;
        removed?: Key[];
    };
    actions: {
        update: {
            added: Record<Key, Derived>;
            removed: Key[];
        };
        ignore: {};
    };
    effects: {
        changed: Record<Key, Derived>;
        noop: {};
    };
};

export const tableView = <Key extends string, Source, Derived>(
    transform: (source: Source) => Derived,
    initial: Record<Key, Derived> = {} as Record<Key, Derived>
) => {
    return defGadget<TableViewSpec<Key, Source, Derived>>(
        (state, input) => {
            const added = {} as Record<Key, Derived>;
            const removed = [] as Key[];

            // Transform added items
            if (input.added) {
                for (const key in input.added) {
                    const result = transform(input.added[key]);
                    if (!_.isNil(result)) {
                        added[key] = result;
                    } else {
                        removed.push(key);
                    }
                }
            }

            // Collect removed keys
            if (input.removed) {
                for (const key of input.removed) {
                    if (state[key] !== undefined) {
                        removed.push(key);
                    }
                }
            }

            if (_.isEmpty(added) && removed.length === 0) {
                return { ignore: {} };
            }

            return { update: { added, removed } };
        },
        {
            update: (gadget, { added, removed }) => {
                const newState = { ...gadget.current() };

                // Add transformed items
                for (const key in added) {
                    newState[key] = added[key]!;
                }

                // Remove items
                for (const key of removed) {
                    delete newState[key];
                }

                gadget.update(newState);
                return { changed: newState };
            },
            ignore: () => ({ noop: {} })
        }
    )(initial);
};

export const wireTableView = <Key extends string, Source, Derived>(
    table: TypedGadget<TableSpec<Key, Source>>,
    view: TypedGadget<TableViewSpec<Key, Source, Derived>>
) => {
    return withTaps(table).tap(({ added, removed }) => {
        if (added) {
            view.receive({
                added,
                removed: removed ? Object.keys(removed) as Key[] : []
            });
        }
    });
};

export const deriveView = <Table, Spec extends ExtractSpec<Table> = ExtractSpec<Table>, Derived = unknown>(
    table: Table,
    transform: (source: Spec['state'][keyof Spec['state']]) => Derived,
) => {
    type TableType = Table extends TypedGadget<TableSpec> ? Table : never;
    type Key = keyof Spec['state'] extends string ? keyof Spec['state'] : never;
    // Create the view gadget
    const view = withTaps(tableView<Key, Spec['state'][keyof Spec['state']], Derived>(transform, {} as Record<Key, Derived>));

    // Auto-wire the connection
    withTaps(table as TableType).tap(({ added, removed }) => {
        if (added || removed) {
            view.receive({
                added: added as Record<Key, Spec['state'][keyof Spec['state']]>,
                removed: removed ? Object.keys(removed) as Key[] : []
            });
        }
    });

    return view;
};

type Pos = { x: number, y: number };
const a = withTaps(lastMap<Pos, Pos>({ x: 0, y: 0 }));
const b = withTaps(lastMap<Pos, Pos>({ x: 0, y: 0 }));
const c = withTaps(lastMap<Pos, Pos>({ x: 0, y: 0 }));

const exampleTable = withTaps(tableCell<string, Pos>({}));

const sumView = deriveView(exampleTable, ({ x, y }) => x + y);
const productView = deriveView(exampleTable, ({ x, y }) => x * y);
const avgView = deriveView(exampleTable, ({ x, y }) => (x + y) / 2);
const xGt10 = deriveView(exampleTable, ({ x }) => x > 10 ? x : null);

a.tap(({ changed }) => {
    exampleTable.receive({
        a: changed,
    });
}, ['changed'])

b.tap(({ changed }) => {
    exampleTable.receive({
        b: changed,
    });
}, ['changed'])

c.tap(({ changed }) => {
    exampleTable.receive({
        c: changed,
    });
}, ['changed'])

a.receive({ x: 1, y: 2 });
b.receive({ x: 2, y: 3 });
c.receive({ x: 3, y: 4 });

console.log('sumView', sumView.current());
console.log('productView', productView.current());
console.log('avgView', avgView.current());
console.log('xGt10', xGt10.current());

c.receive({ x: 15, y: 19 });

console.log('sumView', sumView.current());
console.log('productView', productView.current());
console.log('avgView', avgView.current());
console.log('xGt10', xGt10.current());

c.receive({ x: 5, y: 19 });
console.log('full', exampleTable.current());
console.log('xGt10', xGt10.current());