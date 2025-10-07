import { refProto, withRetry } from "./refs.js";
import { getGadgetById } from "../../extensions/registry.js";

const pkg = "@bassline/refs";

export const gadgetRef = Object.create(refProto);
Object.assign(gadgetRef, {
    pkg,
    name: "gadgetRef",
    validate(input) {
        const id = input?.id;
        if (typeof id !== "string") return undefined;
        return { id };
    },
    shouldResolve(state, input) {
        if (state.id) return false;
        if (input.id) return true;
        return false;
    },
    tryResolve(state, { id }) {
        const { resolve } = state;
        this.update({ ...state, id });
        withRetry(
            () => getGadgetById(id),
        ).then(resolve);
    },
    minState() {
        return {
            id: this.current()?.id,
        };
    },
    isGadgetRef: true,
});
