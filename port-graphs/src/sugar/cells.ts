import { Cleanup } from ".";
import { Emits, Gadget, Implements, quick, Store, Tappable } from "../core/context";
import { Valued } from "../core/protocols";
import { intersectionProto, maxProto, minProto, unionProto } from "../patterns/cells";

interface SweetCell<T> {
    whenChanged(fn: (change: T) => void): Cleanup
}

function sweetenCell<T>(cell: Implements<Valued<T>>) {
    if ('whenChanged' in cell) {
        return cell
    }
    return {
        ...cell,
        whenChanged(fn) {
            return cell.tap(({ changed }) => {
                if (changed !== undefined) {
                    fn(changed)
                }
            })
        }
    } as const satisfies SweetCell<T>
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
    }
}

const a = cells.union<number>();
const b = cells.union<number>();
const c = cells.intersection<number>([]);

a.whenChanged(v => c.receive(v));
b.whenChanged(v => c.receive(v));
c.whenChanged(v => console.log('c changed: ', v));

a.receive(new Set([1, 2, 3, 4, 5]));
b.receive(new Set([3, 4, 5, 6, 7, 8, 9]));