import { createRefType } from "./refs.js";
import { bl } from "@bassline/core";

const pkg = "@bassline/refs";

export const protoRef = createRefType({
    name: "protoRef",
    pkg,
    keyFields: ["pkg", "name"],
    resolver: {
        get: async ({ pkg, name }) => await bl().packages.get(`${pkg}/${name}`),
    },
});
