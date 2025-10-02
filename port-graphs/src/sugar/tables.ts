import { Implements, quick } from "../core/context";
import { Table } from "../core/protocols";
import { firstTableProto, lastTableProto } from "../patterns/cells";

interface TableQuery<T> {
    table: Record<string, T>,
    where(fn: (entry: readonly [string, T]) => boolean): TableQuery<T>
    whereValues(fn: (val: T) => boolean): TableQuery<T>,
    whereKeys(fn: (key: string) => boolean): TableQuery<T>
}
export function tableQuery<T>(table: Record<string, T>): TableQuery<T> {
    return {
        table,
        where(cb) {
            const entries = Object.entries<T>(this.table)
                .filter(cb);
            return tableQuery(Object.fromEntries<T>(entries))
        },
        whereKeys(cb) {
            const entries = Object.entries<T>(this.table)
                .filter(([key, value]) => cb(key));
            return tableQuery(Object.fromEntries<T>(entries))
        },
        whereValues(cb) {
            const entries = Object.entries<T>(this.table)
                .filter(([key, value]) => cb(value));
            return tableQuery(Object.fromEntries<T>(entries))
        },
    } as const satisfies TableQuery<T>
}

export interface SweetTable<T> extends Implements<Table<string, T>> {
    get(key: string): T | undefined,
    getMany(keys: ReadonlyArray<string>): ReadonlyArray<T | undefined>
    set(vals: Record<string, T>): void,
    query(): TableQuery<T>,
    whenAdded(fn: (key: string, value: T) => void): () => void;
}

export function sweetenTable<T>(gadget: Implements<Table<string, T>>) {
    if ('get' in gadget) {
        return gadget as SweetTable<T>
    }
    return {
        ...gadget,
        get(key) {
            return this.current()[key]
        },
        getMany(keys) {
            const curr = this.current();
            return keys.map(k => curr[k] as T)
        },
        set(vals) {
            return this.receive(vals)
        },
        query() {
            return tableQuery(this.current())
        },
        whenAdded(fn) {
            const cleanup = this.tap(e => {
                if ('added' in e && e.added !== undefined) {
                    for (const key in e.added) {
                        const value = e.added[key];
                        if (value === undefined) continue;
                        fn(key, value);
                    }
                }
            });
            return cleanup;
        }
    } as const satisfies SweetTable<T>
}

export const table = {
    first<T>(initial: Record<string, T>) {
        const t = quick(firstTableProto<string, T>(), initial as Record<string, T>)
        return sweetenTable(t)
    },
    last<T>(initial: Record<string, T>) {
        const t = quick(lastTableProto<string, T>(), initial as Record<string, T>)
        return sweetenTable(t)
    }
}