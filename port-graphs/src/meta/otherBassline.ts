import { type State, type Input, type Actions, type Effects, Gadget, defGadget, StateOf, withTaps, InputOf } from '../core/typed';
import { lastCell } from '../patterns/cells';
import { extract } from '../relations';

export type MinimalBasslineSpec<G extends Gadget<any>> =
    & State<{
        gadgets: Set<G>,
        cleanups: Set<{ cleanup: () => void }>
    }>
    & Input<{
        gadgets: G[],
    } | {
        connections: { cleanup: () => void }[]
    } | { nuke: null }>
    & Actions<{
        addGadgets: G[],
        addConnections: { cleanup: () => void }[],
        nuke?: null,
        ignore?: {},
    }>
    & Effects<{
        addedGadgets: G[],
        addedConnections: { cleanup: () => void }[],
        changed: {
            gadgets: Set<G>,
            cleanups: Set<{ cleanup: () => void }>,
        },
        nuked: {},
        ignored: {},
    }>

export const minimalBassline =
    <G extends Gadget<any>>(initial: InputOf<MinimalBasslineSpec<G>>) => {
        const bassline = defGadget<MinimalBasslineSpec<G>>({
            dispatch: (state, input) => {
                if ('gadgets' in input) return { addGadgets: input.gadgets };
                if ('connections' in input) return { addConnections: input.connections };
                if ('nuke' in input) return { nuke: null };
                return null;
            },
            methods: {
                addGadgets: (gadget, gadgets) => {
                    const newState = gadget.current();
                    for (const gadget of gadgets) {
                        newState.gadgets.add(gadget);
                    }
                    gadget.update(newState);
                    return { addedGadgets: gadgets };
                },
                nuke: (gadget, b) => {
                    console.log('nuking');
                    const newState = gadget.current();
                    console.log('nuking', newState.cleanups);
                    newState.cleanups.forEach(cleanup => cleanup.cleanup());
                    console.log('nuked', newState.cleanups);
                    newState.cleanups = new Set();
                    gadget.update(newState);
                    return { nuked: {} };
                },
                addConnections: (gadget, connections) => {
                    const newState = gadget.current();
                    for (const connection of connections) {
                        newState.cleanups.add(connection);
                    }
                    gadget.update(newState);
                    return { addedConnections: connections };
                },
                ignore: () => ({ ignored: {} })
            }
        })({ gadgets: new Set(), cleanups: new Set() });
        bassline.receive(initial);
        return bassline;
    }


const a = withTaps(lastCell(0));
const b = withTaps(lastCell(0));
const c = withTaps(lastCell(0));

const bassline = minimalBassline({
    gadgets: [a, b, c],
    connections: []
});

const d = withTaps(lastCell(0));

bassline.receive({ gadgets: [d] });

bassline.receive({
    connections: [
        extract(a, 'changed', b),
        extract(b, 'changed', c),
        extract(c, 'changed', d),
    ]
});

a.receive(1);
console.log(a.current());
console.log(b.current());
console.log(c.current());
console.log(d.current());

bassline.receive({ nuke: null });

a.receive(2);
console.log(a.current());
console.log(b.current());
console.log(c.current());
console.log(d.current());