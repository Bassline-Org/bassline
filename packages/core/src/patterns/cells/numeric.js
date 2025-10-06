const { gadgetProto } = bl();

const numericProto = Object.create(gadgetProto);
numericProto.validate = asNumber;
numericProto.pkg = "core.cells.numeric";

function asNumber(input) {
    if (typeof input === "number") return input;
    const cast = Number(input);
    if (isNaN(cast)) return undefined;
    return cast;
}

function minStep(current, input) {
    if (input < current) this.update(input);
}

function maxStep(current, input) {
    if (input > current) this.update(input);
}

export function Max(initial) {
    this.step = maxStep.bind(this);
    this.update(initial);
}
Max.prototype = numericProto;

export function Min(initial) {
    this.step = minStep.bind(this);
    this.update(initial);
}
Min.prototype = numericProto;

export default {
    gadgets: {
        Max,
        Min,
    },
};
