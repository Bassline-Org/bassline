const { gadgetProto } = bl();

const setProto = Object.create(gadgetProto);
Object.assign(setProto, {
    pkg: "core.cells.set",
    validate: asSet,
    contradiction({ current, incoming }) {
        console.log("Contradiction! ", current, incoming);
    },
});

const union = Object.create(setProto);
Object.assign(union, {
    step(current, input) {
        if (input.isSubsetOf(current)) return;
        this.update(current.union(input));
    },
    name: "union",
});

const intersection = Object.create(setProto);
Object.assign(intersection, {
    step(current, input) {
        if (input.isSubsetOf(current)) return;
        if (current.size === 0) {
            this.update(input);
            return;
        }
        const intersection = current.intersection(input);
        if (intersection.size === 0) {
            this.contradiction({ current, incoming: input });
        }
        this.update(intersection);
    },
    name: "intersection",
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
