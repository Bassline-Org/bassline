const { gadgetProto } = globalThis.bassline;

const versionedProto = Object.create(gadgetProto);

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

export function Ordinal(initial) {
    this.step = ordinalStep.bind(this);
    this.update([0, initial]);
}
Ordinal.prototype = versionedProto;
