import { createGadget } from "../core";
import { changed, noop } from "../effects";
import { maxCell } from "../patterns/cells";
import { wires } from "./manualWires";

// A meta-gadget that tags values from other gadgets
export const tagger = <T>(tag: string) => {
    return createGadget((current: T | null, incoming: any) => {
        if (current === incoming) return 'ignore';

        // Check if incoming is a 'changed' effect from another gadget
        if (Array.isArray(incoming) && incoming[0] === 'changed') {
            return 'tag';
        }
        return 'ignore';
    })({
        'tag': (gadget, _current, incoming) => {
            // incoming is ['changed', value]
            const [, value] = incoming;
            const taggedValue = { tag, value, original: incoming };
            gadget.update(taggedValue as T);
            return changed(taggedValue);
        },
        'ignore': () => noop()
    })(null);
};

const aTagger = tagger('foo');
const metaTagger = tagger('meta');

const source = maxCell(0);

wires.effectDirected(source, aTagger);
wires.effectDirected(aTagger, metaTagger);

source.receive(10);
source.receive(20);
source.receive(30);
source.receive(20);
source.receive(10);