import { bl, installPackage } from "@bassline/core";
import { installTaps } from "@bassline/taps";
import scopedWirePackage, { scopedWire } from "./scopedWire.js";
const { gadgetProto } = bl();

export function installRelations() {
    const { gadgetProto } = bl();

    if (gadgetProto.tap === undefined) {
        installTaps();
    }
    if (gadgetProto.related !== undefined) {
        console.log("Relations already installed");
        return;
    }
    installGadgetRelations();
    installPackage(scopedWirePackage);
}

function installGadgetRelations() {
    Object.assign(gadgetProto, {
        related(gadgetB, { forward, backward }) {
            if (forward === undefined || backward === undefined) {
                throw new Error(
                    "Forward and backward must be defined! If you meant to have a on way relation, use forward instead!",
                );
            }
            const forwardCleanup = this.tapOn("changed", (changed) => {
                gadgetB.receive(forward(changed));
            });
            const backwardCleanup = gadgetB.tapOn("changed", (changed) => {
                this.receive(backward(changed));
            });
            return () => {
                forwardCleanup();
                backwardCleanup();
            };
        },
        forward(gadgetB, transform = (a) => a) {
            return this.tapOn("changed", (changed) => {
                gadgetB.receive(transform(changed));
            });
        },
        sync(gadgetB) {
            const cleanup = this.related(gadgetB, {
                forward: (a) => a,
                backward: (b) => b,
            });
            return cleanup;
        },
        syncWith(gadgetB, { forward, backward }) {
            if (forward === undefined || backward === undefined) {
                throw new Error("forward and backward must be defined");
            }
            const cleanup = this.related(gadgetB, { forward, backward });
            return cleanup;
        },
    });
}

// Auto-install on import
installRelations();

// Export scopedWire for direct use
export { scopedWire };
