import { bl } from "@bassline/core";

const { gadgetProto } = bl();

const pkg = "@bassline/cells/unsafe";

export const unsafeProto = Object.create(gadgetProto);
Object.assign(unsafeProto, {
    pkg,
});

const last = Object.create(unsafeProto);
Object.assign(last, {
    step(current, input) {
        if (input === current) {
            return;
        }
        this.update(input);
    },
    name: "last",
    defaultState() {
        return null;
    },
    inputs: "any",
    outputs: {
        changed: { type: "any", description: "New value (last write wins)" }
    },
});

export default {
    gadgets: {
        last,
    },
};
