import { Cleanup } from ".";
import { Accepts, Implements, quick } from "../core/context";
import { Valued } from "../core/protocols";
import { intersectionProto, lastProto, maxProto, minProto, ordinalProto, unionProto } from "../patterns/cells";
import { table } from "./tables";

export interface SweetCell<T> {
    whenChanged(fn: (change: T) => void): Cleanup
    sync(target: Implements<Valued<T>>): Cleanup,
    syncWith<I>(target: Implements<Valued<I>>, forward: (input: T) => I, back: (input: I) => T): Cleanup;
    provide(target: Accepts<T>): Cleanup,
    provideWith<I>(target: Accepts<I>, transform: (input: T) => I): Cleanup
}

type Cell<T> = Implements<Valued<T>> & SweetCell<T>

export type Metadata = {
    metadata: ReturnType<typeof table.first<Cell<any>>>,
    withPrefixSet(prefix: string, data: Record<string, any>, cell: (value: unknown) => Cell<unknown>): void
}

export function withMetadata<G extends object>(
    gadget: G,
    initial?: Record<string, Cell<unknown>>
): Metadata & G {
    return Object.assign(gadget, {
        metadata: table.first<Cell<unknown>>(initial ?? {}),
        withPrefixSet(prefix: string, data: Record<string, unknown>, cell: (value: unknown) => Cell<unknown>): void {
            const m = Object.entries(data).map(([k, v]) => [prefix + k, cell(v)])
            this.metadata.set(Object.fromEntries(m))
        }
    }) as Metadata & G
}

function sweetenCell<T>(cell: Implements<Valued<T>>) {
    if ('whenChanged' in cell) {
        return cell
    }
    return {
        ...cell,
        sync(target: Implements<Valued<T>>): Cleanup {
            const cleanups = [
                this.tap(({ changed }) => changed && target.receive(changed)),
                target.tap(({ changed }) => changed && this.receive(changed)),
            ];
            return () => cleanups.forEach(c => c())
        },
        syncWith<I>(target: Implements<Valued<I>>, forward: (input: T) => I, back: (input: I) => T): Cleanup {
            const cleanups = [
                this.tap(({ changed }) => changed && target.receive(forward(changed))),
                target.tap(({ changed }) => changed && this.receive(back(changed))),
            ];
            return () => cleanups.forEach(c => c())
        },
        provide(target: Accepts<T>): Cleanup {
            return this.tap(({ changed }) => changed && target.receive(changed))
        },
        provideWith<I>(target: Accepts<I>, transform: (input: T) => I): Cleanup {
            return this.tap(({ changed }) => changed && target.receive(transform(changed)))
        },
        whenChanged(fn: (change: T) => void): Cleanup {
            return cell.tap(({ changed }) => {
                if (changed !== undefined) {
                    fn(changed)
                }
            })
        }
    } as const
}

// Helper to set metadata with cells.last as default wrapper
export function setMetadata(
    gadget: { metadata: ReturnType<typeof table.first<Cell<any>>> },
    prefix: string,
    data: Record<string, unknown>
): void {
    const entries = Object.entries(data).map(([k, v]) => [
        prefix + k,
        quick(lastProto(), v)
    ]);
    gadget.metadata.set(Object.fromEntries(entries));
}

// Metadata for cell factory functions themselves
const maxMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'max')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/numeric')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Monotonically increasing number')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '📈')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#10b981')) as Cell<unknown>,
    'ui/presets': sweetenCell(quick(lastProto(), [
        { label: '0', input: 0, icon: '0️⃣' },
        { label: '100', input: 100, icon: '💯' },
        { label: '1000', input: 1000, icon: '🔢' },
    ])) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.max(0);
        setMetadata(cell, 'ui/', { position: pos, type: 'max' });
        return cell;
    })) as Cell<unknown>,
};
const minMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'min')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/numeric')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Monotonically decreasing number')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '📉')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#ef4444')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.min(100);
        setMetadata(cell, 'ui/', { position: pos, type: 'min' });
        return cell;
    })) as Cell<unknown>,
};
const unionMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'union')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/set')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Set union - always growing')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '∪')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#3b82f6')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.union([]);
        setMetadata(cell, 'ui/', { position: pos, type: 'union' });
        return cell;
    })) as Cell<unknown>,
};
const intersectionMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'intersection')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/set')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Set intersection - always shrinking')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '∩')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#8b5cf6')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.intersection([]);
        setMetadata(cell, 'ui/', { position: pos, type: 'intersection' });
        return cell;
    })) as Cell<unknown>,
};
const ordinalMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'ordinal')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/versioned')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Versioned value with counter')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '#️⃣')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#f59e0b')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.ordinal(0);
        setMetadata(cell, 'ui/', { position: pos, type: 'ordinal' });
        return cell;
    })) as Cell<unknown>,
};
const lastMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'last')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'cell/basic')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Last-write-wins cell')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '📝')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#6366f1')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const cell = cells.last(0);
        setMetadata(cell, 'ui/', { position: pos, type: 'last' });
        return cell;
    })) as Cell<unknown>,
};

const inspectorMeta: Record<string, Cell<unknown>> = {
    'meta/type': sweetenCell(quick(lastProto(), 'inspector')) as Cell<unknown>,
    'meta/category': sweetenCell(quick(lastProto(), 'ui/tool')) as Cell<unknown>,
    'meta/description': sweetenCell(quick(lastProto(), 'Inspector gadget for examining other gadgets')) as Cell<unknown>,
    'ui/icon': sweetenCell(quick(lastProto(), '🔍')) as Cell<unknown>,
    'ui/color': sweetenCell(quick(lastProto(), '#8b5cf6')) as Cell<unknown>,
    'ui/factory': sweetenCell(quick(lastProto(), (pos: { x: number, y: number }) => {
        const inspector = cells.inspector({ target: null });
        setMetadata(inspector, 'ui/', { position: pos, type: 'inspector' });
        return inspector;
    })) as Cell<unknown>,
};

export const cells = {
    min(initial: number = Infinity) {
        const c = quick(minProto, initial);
        const sweet = sweetenCell(c) as typeof c & SweetCell<number>;
        return withMetadata(sweet, minMeta);
    },
    max(initial: number = -Infinity) {
        const c = quick(maxProto, initial);
        const sweet = sweetenCell(c) as typeof c & SweetCell<number>;
        return withMetadata(sweet, maxMeta);
    },
    union<T>(initial: Array<T> = [] as Array<T>) {
        const c = quick(unionProto<T>(), new Set<T>(initial))
        const sweet = sweetenCell<Set<T>>(c) as typeof c & SweetCell<Set<T>>;
        return withMetadata(sweet, unionMeta);
    },
    intersection<T>(initial: Array<T> = [] as Array<T>) {
        const c = quick(intersectionProto<T>(), new Set<T>(initial))
        const sweet = sweetenCell<Set<T>>(c) as typeof c & SweetCell<Set<T>>;
        return withMetadata(sweet, intersectionMeta);
    },
    ordinal<T>(initial: T) {
        const c = quick(ordinalProto<T>(), [0, initial]);
        const sweet = sweetenCell(c) as typeof c & SweetCell<[number, T]>;
        return withMetadata(sweet, ordinalMeta);
    },
    last<T>(initial: T) {
        const c = quick(lastProto<T>(), initial);
        const sweet = sweetenCell(c) as typeof c & SweetCell<T>;
        return withMetadata(sweet, lastMeta);
    },
    inspector<T = any>(initial: { target: T | null } = { target: null }) {
        const c = quick(lastProto<{ target: T | null }>(), initial);
        const sweet = sweetenCell(c) as typeof c & SweetCell<{ target: T | null }>;
        return withMetadata(sweet, inspectorMeta);
    }
}