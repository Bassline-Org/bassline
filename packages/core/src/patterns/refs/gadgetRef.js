import { refProto, withRetry } from "./refs.js";
import { getGadgetById } from "../../extensions/registry.js";

const pkg = "@bassline/refs";

export const gadgetRef = Object.create(refProto);
Object.assign(gadgetRef, {
    pkg,
    name: "gadgetRef",
    validate(input) {
        const id = input?.id;
        if (typeof id !== "string") return;
        return { id };
    },
    canResolve({ id }) {
        if (id !== undefined) return true;
        return false;
    },
    tryResolve({ id }) {
        return withRetry(
            () => getGadgetById(id),
        );
    },
    minState() {
        return {
            id: this.current()?.id,
        };
    },
    isGadgetRef: true,
});
