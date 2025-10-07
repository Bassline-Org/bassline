import { gadgetProto } from "../../gadget.js";
import { gadgetRef } from "../refs/gadgetRef.js";
import { refProto } from "../refs/refs.js";

function isGadgetRef(gadget) {
    if (gadget === undefined) return false;
    return gadgetRef.isPrototypeOf(gadget);
}

export const wire = Object.create(refProto);
Object.assign(wire, {
    pkg: "@bassline/relations",
    name: "wire",
    validate(input) {
        const validated = {};
        if (isGadgetRef(input.source)) {
            validated.source = input.source;
        }
        if (isGadgetRef(input.target)) {
            validated.target = input.target;
        }
        if (Object.keys(validated).length === 0) return;
        return validated;
    },
    enuf({ source, target }) {
        return source !== undefined && target !== undefined;
    },
    async compute({ source, target }) {
        const [s, t] = await Promise.all([source.promise, target.promise]);
        const cleanup = s.tapOn("changed", (c) => t.receive(c));
        t.receive(s.current());
        return cleanup;
    },
    toSpec() {
        const { source, target } = this.current();
        return {
            pkg: this.pkg,
            name: this.name,
            state: {
                source: source?.toSpec(),
                target: target?.toSpec(),
            },
        };
    },
});

export default {
    gadgets: {
        wire,
    },
};
