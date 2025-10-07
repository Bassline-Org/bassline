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
    enuf(next) {
        return next.id !== undefined;
    },
    async compute({ id }) {
        return await withRetry(
            () => getGadgetById(id),
        );
    },
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: {
                id: this.current()?.id,
            },
        };
    },
});
