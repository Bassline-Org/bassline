const { gadgetProto } = bl();

export const unsafeProto = Object.create(gadgetProto);
Object.assign(unsafeProto, {
    pkg: "core.cells.unsafe",
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
});

export default {
    gadgets: {
        last,
    },
};
