import { refProto, withRetry } from "./refs.js";
import { getGadgetById } from "../../extensions/registry.js";
import { isNotNil, isString, pick } from "../../utils.js";

const pkg = "@bassline/refs";

export const gadgetRef = Object.create(refProto);
Object.assign(gadgetRef, {
    pkg,
    name: "gadgetRef",
    validate(input) {
        const valid = pick(input, ["id"]);
        if (!isString(valid.id)) return;
        return valid;
    },
    enuf(next) {
        return isNotNil(next.id);
    },
    async compute({ id }) {
        return await withRetry(
            () => getGadgetById(id),
        );
    },
    stateSpec() {
        return pick(this.current(), ["id"]);
    },
});
