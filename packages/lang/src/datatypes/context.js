import { normalize } from "../utils.js";
import { Datatype, nil, Value } from "./core.js";

export class Context extends Value {
    constructor(parent = null, type = "context!") {
        super(type);
        this.bindings = new Map();
        this.set("self", this);
        if (parent) {
            this.set("parent", parent);
        }
    }

    get(spelling) {
        const normalized = normalize(spelling);

        // Try local bindings first
        if (this.hasLocal(normalized)) {
            return this.bindings.get(normalized);
        }

        // Then try parent chain
        if (this.hasLocal("parent")) {
            return this.get("parent").get(spelling);
        }

        return nil;
    }

    set(spelling, value) {
        this.bindings.set(normalize(spelling), value);
        return value;
    }

    setMany(bindingObj) {
        for (const [key, value] of Object.entries(bindingObj)) {
            this.set(key, value);
        }
        return this;
    }

    // Check if a binding exists locally (not in parent)
    hasLocal(spelling) {
        return this.bindings.has(normalize(spelling));
    }

    // Update existing binding (searches up parent chain)
    update(spelling, value) {
        const normalized = normalize(spelling);

        if (this.hasLocal(normalized)) {
            this.set(normalized, value);
            return true;
        }

        if (this.hasLocal("parent")) {
            const parent = this.get("parent");
            return parent.update(spelling, value);
        }

        return false;
    }

    pick(index) {
        const indexValue = index.to("word!");
        return this.get(indexValue.spelling);
    }

    pluck(index) {
        const indexValue = index.to("word!");
        const value = this.get(indexValue.spelling);
        this.bindings.delete(indexValue.spelling);
        return value;
    }

    insert(index, value) {
        const indexValue = index.to("word!");
        this.set(indexValue.spelling, value);
        return value;
    }

    static make(stream, context) {
        return new Context(null);
    }
}

export default {
    "context!": new Datatype(Context),
};
