import { bl } from "@bassline/core";
import { StateSymbol } from "@bassline/core/gadget";

const { gadgetProto } = bl();

export const scopedWire = Object.create(gadgetProto);
Object.assign(scopedWire, {
    pkg: "@bassline/relations",
    name: "scopedWire",

    validate(input) {
        const valid = {};
        let isValid = false;
        if (input.source) {
            if (gadgetProto.isPrototypeOf(input.source)) {
                valid.source = input.source;
                isValid = true;
            }
        }
        if (input.target) {
            if (gadgetProto.isPrototypeOf(input.target)) {
                valid.target = input.target;
                isValid = true;
            }
        }
        if (isValid) {
            return valid;
        } else {
            return undefined;
        }
    },
    step(state = {}, input) {
        const { source, target } = state;
        if (source && target) {
            return;
        }
        const next = { ...state, ...input };
        if (next.source && next.target) {
            const cleanup = next.source.tap((e) => next.target.receive(e));
            this.update(next);
            this.cleanup = cleanup;
        }
    },
    onKill() {
        this.cleanup?.();
        this[StateSymbol] = null;
    },
});

export default {
    gadgets: {
        scopedWire,
    },
};
