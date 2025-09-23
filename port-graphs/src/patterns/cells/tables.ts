import _ from 'lodash';
import { defGadget } from '../../core/typed';
import { CellSpec } from '../specs';

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