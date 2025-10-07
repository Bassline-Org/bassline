const { gadgetProto } = bl();

const numericProto = Object.create(gadgetProto);
Object.assign(numericProto, {
    pkg: "core.cells.numeric",
    validate: asNumber,
});

export const max = Object.create(numericProto);
Object.assign(max, {
    step(current, input) {
        if (input > current) this.update(input);
    },
    name: "max",
});

export const min = Object.create(numericProto);
Object.assign(min, {
    step(current, input) {
        if (input < current) this.update(input);
    },
    name: "min",
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
