import { createRefType } from "./refs.js";
import { getGadgetById } from "../../extensions/registry.js";

const pkg = "@bassline/refs";

export const gadgetRef = createRefType({
    name: "gadgetRef",
    pkg,
    keyFields: ["id"],
    resolver: getGadgetById,
});
