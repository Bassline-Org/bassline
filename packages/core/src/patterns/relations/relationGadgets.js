import { gadgetProto } from "../../gadget.js";
import { gadgetRef } from "../refs/gadgetRef.js";

export const wire = Object.create(gadgetProto);
Object.assign(wire, {
    pkg: "@bassline/relations",
    name: "wire",
    validate({ source, target, reset }) {
        if (reset) {
            return { reset };
        }
        if (source.isGadgetRef && target.isGadgetRef) {
            return { bind: { source, target } };
        }
    },
    step(state, { bind, target, reset }) {
        if (reset) {
            const { cleanup } = state;
            cleanup?.();
        }
        if (bind && state.source && state.target) {
            return;
        }
        const { source, target } = bind;
        Promise.all([source.promise(), target.promise()])
            .then(() => {
                const cleanup = source.tapOn(
                    "changed",
                    (c) => target.receive(c),
                );
                this.update({ ...state, source, target, cleanup });
            });
    },
    minState() {
        const { source, target } = this.current();
        return {
            source: source,
            target: target,
        };
    },
});
