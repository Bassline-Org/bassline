import { createRefType } from "./refs.js";

const pkg = "@bassline/refs";

export const localRef = createRefType({
    name: "localRef",
    pkg,
    keyFields: ["name"],
    resolverField: "scope",
});
