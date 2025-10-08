import { gadgetProto } from "../../gadget.js";
import { refProto } from "../refs/refs.js";

function isRef(gadget) {
    if (gadget === undefined) return false;
    return refProto.isPrototypeOf(gadget);
}

export const wire = Object.create(refProto);
Object.assign(wire, {
    pkg: "@bassline/relations",
    name: "wire",
    validate(input) {
        const validated = {};
        if (isRef(input.source)) {
            validated.source = input.source;
        }
        if (isRef(input.target)) {
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
    stateSpec() {
        const { source, target } = this.current();
        return {
            source: source?.toSpec(),
            target: target?.toSpec(),
        };
    },
});

export default {
    gadgets: {
        wire,
    },
};
