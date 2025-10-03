import { Implements } from "../core/context";
import { Valued } from "../core/protocols";
import { cells, SweetCell } from "./cells";
import { table } from "./tables";

type Cell<T> = Implements<Valued<T>> & SweetCell<T>

export type Metadata<T = unknown> = {
    metadata: ReturnType<typeof table.first<Cell<T>>>,
    withPrefixSet(prefix: string, data: Record<string, T>, cell?: (value: T) => Cell<T>): void,
}

export function withSharedMetadata<T, G extends Implements<Valued<any>>>(gadget: G, metadata: ReturnType<typeof table.first<Cell<T>>>): Metadata<T> & G {
    return Object.assign(gadget, {
        metadata,
        withPrefixSet(prefix: string, data: Record<string, T>, cell: (value: T) => Cell<T> = (v: T) => cells.last<T>(v) as Cell<T>): void {
            const m = Object.entries(data).map(([k, v]) => [prefix + k, cell(v)])
            metadata.set(Object.fromEntries(m))
        }
    }) as Metadata<T> & G
}

export function withMetadata<T, G extends Implements<Valued<any>>>(gadget: G): Metadata<T> & G {
    const g = Object.assign(gadget, {
        metadata: table.first<Cell<unknown>>({}),
        withPrefixSet(
            prefix: string,
            data: Record<string, T>,
            cell: ((value: T) => Cell<T>) = (v: T) => cells.last<T>(v) as Cell<T>
        ): void {
            const m = Object.entries(data).map(([k, v]) => [prefix + k, cell(v)])
            g.metadata.set(Object.fromEntries(m))
        }
    });
    return g as Metadata<T> & G
}

const a = withMetadata(cells.max(0));
a.withPrefixSet('meta/', {
    name: 'Max',
    description: 'Max cell forms a semi-lattice, via the >= numeric relation. Monotonically increases.',
    tags: ['cell', 'monotonic', 'numeric', 'core'],
    author: 'goose',
});
const query = a.metadata.query()
    .whereKeys(k => k.startsWith('meta/'))
    .mapKeys(k => k.replace('meta/', ''))
    .map(v => v.current())
    .table;
console.log(query)