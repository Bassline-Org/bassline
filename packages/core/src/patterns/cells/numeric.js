import { gadgetProto } from "../../gadget.js";

/**
 * @param {any} input
 * @returns {number | undefined}
 */
function asNumber(input) {
    if (typeof input === "number") return input;
    const cast = Number(input);
    if (isNaN(cast)) return undefined;
    return cast;
}

function minStep(current, input) {
    const validated = asNumber(input);
    if (validated === undefined) return;
    if (validated < current) this.update(validated);
}

function maxStep(current, input) {
    const validated = asNumber(input);
    if (validated === undefined) return;
    if (validated > current) this.update(validated);
}

export function Max(initial) {
    this.step = maxStep.bind(this);
    this.update(initial);
}
Max.prototype = gadgetProto;
export function Min(initial) {
    this.step = minStep.bind(this);
    this.update(initial);
}
Min.prototype = gadgetProto;
