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
    resolve({ id }) {
        if (this.current()?.resolved) return;
        this.update({ ...this.current(), id });
        withRetry(
            () => getGadgetById(id),
        ).then((gadget) => {
            this.update({ ...this.current(), id, gadget, resolved: true });
            this.emit({ resolved: { id, gadget } });
        }).catch((error) => {
            this.error(error, { id });
        });
    },
    minState() {
        return {
            id: this.current()?.id,
        };
    },
});
