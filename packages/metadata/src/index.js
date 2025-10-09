import { bl } from "@bassline/core";
import { tables } from "@bassline/cells";

const metadataSymbol = Symbol("bassline-metadata");

export function installMetadata() {
    const { gadgetProto } = bl();

    if (gadgetProto.metadata !== undefined) {
        return;
    }

    Object.assign(gadgetProto, {
        get metadata() {
            if (this[metadataSymbol] === undefined) {
                this[metadataSymbol] = tables.gadgets.first.spawn({});
            }
            return this[metadataSymbol];
        },
    });
}

// Auto-install on import
installMetadata();
