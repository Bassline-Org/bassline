import { normalize, normalizeString } from "../utils.js";
import { Datatype, nil, Str, Value, Word } from "./core.js";

export class Context extends Value {
    static type = normalizeString("context!");
    constructor(parent = null) {
        super();
        this.bindings = new Map();
        this.set("self", this);
        if (parent !== null) {
            this.set("parent", parent);
        }
    }

    form() {
        const formed = [];
        for (const [key, value] of this.bindings.entries()) {
            if (value === this) {
                formed.push([key.description, "<self>"]);
                continue;
            }
            if (value instanceof Context) {
                formed.push([key.description, "<parent>"]);
                continue;
            }
            formed.push([key.description, value.form().value]);
        }
        return new Str(`context! [
  ${formed.map(([key, value]) => `${key}: ${value}`).join("\n  ")}
]`);
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
        const normalized = spelling.to("word!").spelling;

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
        return new Context(context);
    }
}

export default {
    "context!": new Datatype(Context),
};
