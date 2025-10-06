const { gadgetProto } = globalThis.bassline;

function asNumber(input) {
    if (typeof input === "number") return input;
    const cast = Number(input);
    if (isNaN(cast)) return undefined;
    return cast;
}
const numericProto = Object.create(gadgetProto);
numericProto.validate = asNumber;

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
