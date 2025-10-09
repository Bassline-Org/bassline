import { currentScope } from "@bassline/core";
import { createRefType } from "./refs.js";
import { refProto } from "./refs.js";

const pkg = "@bassline/refs";

export const localRef = createRefType({
    name: "localRef",
    pkg,
    keyFields: ["name"],
    async resolver(args) {
        if (this.scope === undefined) {
            this.scope = currentScope();
        }
        const s = this.scope;
        if (s === null) {
            throw new Error("No scope found");
        } else {
            return await s.get(args.name);
        }
    },
});
