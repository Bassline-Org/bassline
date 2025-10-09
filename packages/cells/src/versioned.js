import { bl } from "@bassline/core";

const { gadgetProto } = bl();

const pkg = "@bassline/cells/versioned";

export const versionedProto = Object.create(gadgetProto);
Object.assign(versionedProto, {
    pkg,
});

export const ordinal = Object.create(versionedProto);
Object.assign(ordinal, {
    step: ordinalStep,
    name: "ordinal",
});

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

export default {
    gadgets: {
        ordinal,
    },
};
