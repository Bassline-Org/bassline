import { normalize } from "./utils.js";
import { Value } from "./values.js";

export class Context extends Value {
    constructor(parent = null) {
        super();
        this.bindings = new Map();
        this.parent = parent;
    }

    get(spelling) {
        const normalized = normalize(spelling);

        // Try local bindings first
        if (this.bindings.has(normalized)) {
            return this.bindings.get(normalized);
        }

        // Then try parent chain
        if (this.parent) {
            return this.parent.get(spelling);
        }

        return undefined;
    }

    set(spelling, value) {
        this.bindings.set(normalize(spelling), value);
    }

    // Check if a binding exists locally (not in parent)
    hasLocal(spelling) {
        return this.bindings.has(normalize(spelling));
    }

    // Update existing binding (searches up parent chain)
    update(spelling, value) {
        const normalized = normalize(spelling);

        if (this.bindings.has(normalized)) {
            this.bindings.set(normalized, value);
            return true;
        }

        if (this.parent) {
            return this.parent.update(spelling, value);
        }

        return false;
    }

    mold() {
        return `context [${
            Array.from(this.bindings.entries()).map(([key, value]) =>
                `${key.description}: ${value.mold ? value.mold() : value}`
            ).join(" ")
        }]`;
    }
}
