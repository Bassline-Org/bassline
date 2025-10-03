import { withMetadata } from ".";
import { Implements, quick, Table } from "../core";
import { firstTableProto, lastTableProto } from "../patterns/cells";

export interface TableQuery<T> {
    table: Record<string, T>,
    map<R>(fn: (entry: T) => R): TableQuery<R>,
    mapKeys(fn: (key: string) => string): TableQuery<T>,
    mapEntries(fn: (entry: readonly [string, T]) => readonly [string, T]): TableQuery<T>,
    where(fn: (entry: readonly [string, T]) => boolean): TableQuery<T>,
    whereValues(fn: (val: T) => boolean): TableQuery<T>,
    whereKeys(fn: (key: string) => boolean): TableQuery<T>
}

export function tableQuery<T>(table: Record<string, T>): TableQuery<T> {
    return {
        table,
        map(fn) {
            return tableQuery(Object.fromEntries(Object.entries(this.table).map(([key, value]) => [key, fn(value)])))
        },
        mapKeys(fn) {
            return tableQuery(Object.fromEntries(Object.entries(this.table).map(([key, value]) => [fn(key), value])))
        },
        mapEntries(fn) {
            return tableQuery(Object.fromEntries(Object.entries(this.table).map(fn)))
        },
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

export interface SweetTable<T> {
    get(key: string): T | undefined,
    getMany(keys: ReadonlyArray<string>): ReadonlyArray<T | undefined>
    set(vals: Record<string, T>): void,
    query(): TableQuery<T>,
    whenChanged(fn: (key: string, value: T) => void): () => void,
    whenAdded(fn: (key: string, value: T) => void): () => void;
}

export function sweetenTable<T>(gadget: Implements<Table<string, T>>) {
    if ('get' in gadget) {
        return gadget as typeof g & SweetTable<T>
    }
    const g: typeof gadget & SweetTable<T> = {
        ...gadget,
        get(key: string): T | undefined {
            return this.current()[key]
        },
        getMany(keys: ReadonlyArray<string>): ReadonlyArray<T | undefined> {
            const curr = this.current();
            return keys.map(k => curr[k] as T)
        },
        set(vals: Record<string, T>): void {
            return this.receive(vals)
        },
        query(): TableQuery<T> {
            return tableQuery(this.current())
        },
        whenChanged(fn) {
            const cleanup = this.tap(e => {
                if ('changed' in e && e.changed !== undefined) {
                    for (const key in e.changed) {
                        const value = e.changed[key];
                        if (value === undefined) continue;
                        fn(key, value);
                    }
                }
            });
            return cleanup;
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
    } as const
    return g as typeof g & SweetTable<T>
}

export const table = {
    first<T>(initial: Record<string, T>) {
        const t = quick(firstTableProto<string, T>(), initial as Record<string, T>)
        return sweetenTable(t) as typeof t & SweetTable<T>
    },
    last<T>(initial: Record<string, T>) {
        const t = quick(lastTableProto<string, T>(), initial as Record<string, T>)
        return sweetenTable(t) as typeof t & SweetTable<T>
    },
}