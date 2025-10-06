import { installTaps } from "../../extensions/taps.js";
import { functionProto, Partial, Transform } from "../functions/index.js";
const { gadgetProto } = bl();

export function installRelations() {
    if (gadgetProto.tap === undefined) {
        installTaps();
    }
    if (gadgetProto.related !== undefined) {
        console.log("Relations already installed");
        return;
    }
    installFunctionRelations();
    installGadgetRelations();
}

function installFunctionRelations() {
    Object.assign(functionProto, {
        fanOut(targets = []) {
            if (targets.length === 0) {
                return () => {};
            }
            return targets.map((target) => {
                return this.tapOn("computed", (computed) => {
                    target.receive(computed);
                });
            });
        },
        derive(fn) {
            const func = new Transform({ fn });
            const cleanup = this.tapOn("computed", (computed) => {
                func.receive(computed);
            });
            return [func, cleanup];
        },
    });
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
        asArgument(arg, fn) {
            if (!(fn instanceof Partial || fn instanceof Transform)) {
                console.log(fn.prototype);
                throw new Error("fn must be a Partial or Transform");
            }
            if (!fn.requiredKeys.includes(arg)) {
                console.warn(
                    `${arg} is not a required key of ${fn.name}, so it will not be updated when ${this.name} changes`,
                );
                return () => {};
            }
            if (this instanceof Partial || this instanceof Transform) {
                return this.tapOn("computed", (computed) => {
                    fn.receive({ [arg]: computed });
                });
            } else {
                return this.tapOn("changed", (changed) => {
                    fn.receive({ [arg]: changed });
                });
            }
        },
        /**
         * Derive a new function from this gadget
         * @param {*} fn - The function to derive
         * @returns [derivedFunction, cleanup]
         */
        derive(fn) {
            const func = new Transform({ fn });
            const cleanup = this.forward(func);
            return [func, cleanup];
        },
    });
}
