import { refProto, withRetry } from "./refs.js";
import { pick } from "../../utils.js";

const pkg = "@bassline/refs";

export const localRef = Object.create(refProto);
Object.assign(localRef, {
    pkg,
    name: "localRef",

    validate(input) {
        const valid = {};
        if (input.name !== undefined) valid.name = input.name;
        if (input.scope !== undefined) valid.scope = input.scope;
        if (Object.keys(valid).length === 0) return undefined;
        return valid;
    },

    enuf({ name, scope }) {
        return name !== undefined && scope !== undefined;
    },

    getResolver(state) {
        // The scope is the resolver
        return state.scope;
    },

    async compute({ name }, resolver) {
        // Retry until gadget appears in scope
        return await withRetry(
            () => {
                const gadget = resolver.get(name);
                if (!gadget) return undefined; // Not ready, retry
                return gadget;
            },
            10, // attempts
            100, // delay in ms
        );
    },

    stateSpec() {
        // Only serialize the name, not the scope
        return pick(this.current(), ["name"]);
    },
});
