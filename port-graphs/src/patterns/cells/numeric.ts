import { createGadget } from "../../core";
import { changed, noop } from "../../effects";
import _ from "lodash";

export const maxCell = createGadget((current: number, incoming: number) => {
    if (incoming > current) return 'merge';
    return 'ignore';
})({
    'merge': (gadget, current, incoming) => {
        const result = Math.max(current, incoming);
        gadget.update(result);
        return changed(result);
    },
    'ignore': (_gadget, _current, _incoming) => noop()
});

export const minCell = createGadget((current: number, incoming: number) => {
    if (incoming < current) return 'merge';
    return 'ignore';
})({
    'merge': (gadget, current, incoming) => {
        const result = Math.min(current, incoming);
        gadget.update(result);
        return changed(result);
    },
    'ignore': (_gadget, _current, _incoming) => noop()
});

// function test() {
//     const max = maxCell(10);
//     const min = minCell(10);
//     max.receive(20);
//     console.log('max.current(): ', max.current());

//     min.receive(5);
//     console.log('min.current(): ', min.current());
// }