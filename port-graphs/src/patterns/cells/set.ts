import _ from "lodash";
import { createGadget } from "../../core";
import { changed, contradiction, noop } from "../../effects";

export const unionCell = createGadget((current: Set<any>, incoming: Set<any>) => {
    if (incoming.size > current.size) return 'merge';
    if (incoming.isSubsetOf(current)) return 'ignore';
    return 'merge';
})({
    'merge': (gadget, current, incoming) => {
        const result = current.union(incoming);
        if (result.isSupersetOf(current)) {
            gadget.update(result);
            return changed(result);
        }
        return noop();
    },
    'ignore': (_gadget, _current, _incoming) => noop()
});

export const intersectionCell = createGadget((current: Set<any>, incoming: Set<any>) => {
    // GOOSE: Should do a smarter check here, TOO BAD!
    const overlap = current.intersection(incoming);
    if (overlap.size === 0) return 'contradiction';
    if (overlap.size === current.size) return 'ignore';
    return 'merge';
})({
    'merge': (gadget, current, incoming) => {
        const result = current.intersection(incoming);
        gadget.update(result);
        return changed(result);
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    },
    'contradiction': (_gadget, current, incoming) => {
        return contradiction(current, incoming);
    }
});

// NOTE: This is not a cell, issa function, because set difference is not idempotent
// export const differenceCell = createGadget((_current: Set<any>, _incoming: Set<any>) => {
//     return 'merge';
// })({
//     'merge': (gadget, current, incoming) => {
//         const result = current.symmetricDifference(incoming);
//         if (result.size > 0) {
//             gadget.update(result);
//             return changed(result);
//         } else {
//             return noop();
//         }
//     },
// });

// function test() {
//     const current = new Set([1, 2, 3]);
//     const incoming = new Set([2, 3, 4]);
//     const gadget = intersectionCell(current);
//     gadget.receive(incoming);
//     console.log('gadget.current(): ', gadget.current());
//     gadget.receive(new Set([2, 3, 4]));
//     console.log('gadget.current(): ', gadget.current());
//     gadget.receive(new Set([2, 3, 4]));

//     const union = unionCell(new Set([1, 2, 3]));
//     const otherUnion = unionCell(new Set([]));
//     wires.bi(union, otherUnion);
//     otherUnion.receive(new Set([4, 5, 6]));
//     console.log('otherUnion.current(): ', otherUnion.current());
//     otherUnion.receive(new Set([4, 5, 6]));
//     console.log('otherUnion.current(): ', otherUnion.current());
//     console.log('union.current(): ', union.current());
//     const diff = otherUnion.current().difference(union.current());
//     console.log('diff: ', diff);
// }