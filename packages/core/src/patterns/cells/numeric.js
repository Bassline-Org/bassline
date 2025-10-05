import { Gadget, gadgetProto } from "../../gadget.js";

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

export default {
    max(initial) {
        return new Gadget(maxStep, initial);
    },
    min(initial) {
        return new Gadget(minStep, initial);
    },
};
