import { Cleanup } from ".";
import { Accepts, Implements, quick } from "../core/context";
import { Valued } from "../core/protocols";
import { intersectionProto, maxProto, minProto, ordinalProto, unionProto } from "../patterns/cells";

interface SweetCell<T> {
    whenChanged(fn: (change: T) => void): Cleanup
    sync(target: Implements<Valued<T>>): Cleanup,
    syncWith<I>(target: Implements<Valued<I>>, forward: (input: T) => I, back: (input: I) => T): Cleanup;
    provide(target: Accepts<T>): Cleanup,
    provideWith<I>(target: Accepts<I>, transform: (input: T) => I): Cleanup
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

export const cells = {
    min(initial: number = Infinity) {
        const c = quick(minProto, initial);
        return sweetenCell(c) as typeof c & SweetCell<number>
    },
    max(initial: number = -Infinity) {
        const c = quick(maxProto, initial);
        return sweetenCell(c) as typeof c & SweetCell<number>
    },
    union<T>(initial: Array<T> = [] as Array<T>) {
        const c = quick(unionProto<T>(), new Set<T>(initial))
        return sweetenCell<Set<T>>(c) as typeof c & SweetCell<Set<T>>
    },
    intersection<T>(initial: Array<T> = [] as Array<T>) {
        const c = quick(intersectionProto<T>(), new Set<T>(initial))
        return sweetenCell<Set<T>>(c) as typeof c & SweetCell<Set<T>>
    },
    ordinal<T>(initial: T) {
        const c = quick(ordinalProto<T>(), [0, initial]);
        return sweetenCell(c) as typeof c & SweetCell<[number, T]>
    }
}

const a = cells.union<number>();
const b = cells.union<number>();
const c = cells.intersection<number>([]);



//a.sync(c);
//b.sync(c);

//c.whenChanged(v => console.log('c changed: ', v));