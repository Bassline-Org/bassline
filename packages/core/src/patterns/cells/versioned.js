import { Gadget } from "../../gadget.js";

function asOrdinal(input) {
    if (Array.isArray(input) && input.length === 2) {
        return input;
    }
    return undefined;
}

function ordinalStep(current, input) {
    const validated = asOrdinal(input);
    if (validated === undefined) return;
    if (validated[0] > current[0]) this.update(validated);
}

export function ordinal(initial) {
    return new Gadget(ordinalStep, [0, initial]);
}
