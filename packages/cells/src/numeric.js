import { bl } from "@bassline/core";

const { gadgetProto } = bl();

const pkg = "@bassline/cells/numeric";

const numericProto = Object.create(gadgetProto);
Object.assign(numericProto, {
    pkg,
    validate: asNumber,
});

export const max = Object.create(numericProto);
Object.assign(max, {
    step(current, input) {
        if (input > current) this.update(input);
    },
    name: "max",
    defaultState() {
        return -Infinity;
    },
    inputs: "number",
    outputs: {
        changed: { type: "number", description: "New maximum value" },
        accepted: { type: "boolean", description: "True if input was greater" },
        rejected: { type: "boolean", description: "True if input was not greater" }
    },
});

export const min = Object.create(numericProto);
Object.assign(min, {
    step(current, input) {
        if (input < current) this.update(input);
    },
    name: "min",
    defaultState() {
        return Infinity;
    },
    inputs: "number",
    outputs: {
        changed: { type: "number", description: "New minimum value" },
        accepted: { type: "boolean", description: "True if input was less" },
        rejected: { type: "boolean", description: "True if input was not less" }
    },
});

function asNumber(input) {
    if (typeof input === "number") return input;
    const cast = Number(input);
    if (isNaN(cast)) return undefined;
    return cast;
}

export default {
    gadgets: {
        max,
        min,
    },
};
