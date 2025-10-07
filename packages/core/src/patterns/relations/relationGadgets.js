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
        if (source?.isGadgetRef && target?.isGadgetRef) {
            return { bind: { source, target } };
        }
    },
    step(state, { bind, reset }) {
        if (state.resolving) return;

        if (reset) {
            const { cleanup } = state;
            cleanup?.();
            this.update({ resolving: false, resolved: false });
        }

        if (state.resolved) return;

        if (bind === undefined) return;

        const { source, target } = bind;
        this.update({ ...state, resolving: true });
        Promise.all([source.promise, target.promise])
            .then(() => {
                this.update({
                    ...state,
                    source,
                    target,
                    resolving: false,
                    resolved: true,
                });
                const cleanup = source.tapOn(
                    "changed",
                    (c) => target.receive(c),
                );
                this.update({ ...state, source, target, cleanup });
            });
    },
    afterSpawn(initial) {
        this.update({ resolving: false, resolved: false });
        this.receive({ ...initial });
    },
    toSpec() {
        const { source, target } = this.current();
        return {
            pkg: this.pkg,
            name: this.name,
            state: {
                source: source.toSpec(),
                target: target.toSpec(),
            },
        };
    },
});

export default {
    gadgets: {
        wire,
    },
};
