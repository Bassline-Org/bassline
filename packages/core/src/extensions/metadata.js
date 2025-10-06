const { gadgetProto } = globalThis.bassline;

import { First } from "../patterns/cells/tables.js";

const metadataSymbol = Symbol("bassline-metadata");

export function installMetadata() {
    if (gadgetProto.metadata !== undefined) {
        return;
    }

    Object.assign(gadgetProto, {
        get metadata() {
            if (this[metadataSymbol] === undefined) {
                this[metadataSymbol] = new First();
            }
            return this[metadataSymbol];
        },
    });
}
