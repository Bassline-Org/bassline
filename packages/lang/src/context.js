import { normalize } from "./utils.js";

export class Context {
    constructor(parent = null) {
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
}
