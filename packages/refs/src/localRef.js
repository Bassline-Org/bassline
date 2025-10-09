import { currentScope } from "../../core/src/scope.js";
import { createRefType } from "./refs.js";

const pkg = "@bassline/refs";

export const localRef = createRefType({
    name: "localRef",
    pkg,
    keyFields: ["name"],
    resolve: {
        get: async (args) => {
            const s = currentScope();
            if (s === null) {
                throw new Error("No scope found");
            } else {
                return await s.get(args.name);
            }
        },
    },
});
