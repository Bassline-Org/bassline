import { bl } from "@bassline/core";

const { gadgetProto } = bl();

const pkg = "@bassline/cells/set";
const setProto = Object.create(gadgetProto);
Object.assign(setProto, {
    pkg,
    validate: asSet,
    contradiction({ current, incoming }) {
        console.error("Contradiction! ", current, incoming);
    },
    defaultState() {
        return new Set();
    },
    afterSpawn(initial) {
        const state = initial !== undefined ? initial : this.defaultState();
        this.update(state);
    },
});

export const union = Object.create(setProto);
Object.assign(union, {
    step(current, input) {
        if (input.isSubsetOf(current)) return;
        this.update(current.union(input));
    },
    name: "union",
    inputs: "set",
    outputs: {
        changed: { type: "set", description: "New union result" },
        accepted: { type: "boolean", description: "True if input added new elements" },
        rejected: { type: "boolean", description: "True if input was subset" }
    },
});

export const intersection = Object.create(setProto);
Object.assign(intersection, {
    step(current, input) {
        if (input.isSubsetOf(current)) return;
        if (current.size === 0) {
            this.update(input);
            return;
        }
        const intersection = current.intersection(input);
        if (intersection.size === 0) {
            return this.contradiction({ current, incoming: input });
        }
        this.update(intersection);
    },
    name: "intersection",
    inputs: "set",
    outputs: {
        changed: { type: "set", description: "New intersection result" },
        accepted: { type: "boolean", description: "True if input refined the set" },
        rejected: { type: "boolean", description: "True if input was subset" },
        contradiction: { type: "object", description: "Contradiction detected" }
    },
});

function asSet(input) {
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input);
    return new Set([input]);
}

export default {
    gadgets: {
        union,
        intersection,
    },
};
