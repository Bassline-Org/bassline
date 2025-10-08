import { createRefType } from "./refs.js";

const pkg = "@bassline/refs";

export const localRef = createRefType({
    name: "localRef",
    pkg,
    keyFields: ["name"],
    resolverField: "scope",
});

// Override toSpec to use sugar syntax
Object.assign(localRef, {
    toSpec() {
        // Use sugar syntax: { ref: "name" }
        // This makes wire specs much cleaner
        const name = this.current().name;
        if (name !== undefined) {
            return { ref: name };
        }
        // Fallback to full spec if name not available
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.current(),
        };
    },
});
