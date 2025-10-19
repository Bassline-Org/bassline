import { normalize, normalizeString } from "../utils.js";
import {
    Block,
    Bool,
    Datatype,
    LitWord,
    nil,
    Str,
    Value,
    Word,
} from "./core.js";

export class ContextBase extends Value {
    static type = normalizeString("any-context!");
    constructor() {
        super();
        this.bindings = new Map();
        this.set("self", this);
    }

    keyFor(word) {
        if (typeof word === "symbol") return word;
        if (word?.spelling) return word.spelling;
        if (word instanceof Str) return normalize(word.value);
        if (typeof word === "string") return normalize(word);
        console.log("type: ", typeof word);
        throw new Error(`Invalid string ${JSON.stringify(word)}`);
    }

    has(word) {
        const spelling = this.keyFor(word);
        const result = this.bindings.has(spelling);
        return new Bool(result);
    }

    get(word) {
        const spelling = this.keyFor(word);
        const value = this.bindings.get(spelling);
        if (value === undefined) {
            return nil;
        }
        return value;
    }

    set(word, value) {
        const spelling = this.keyFor(word);
        this.bindings.set(spelling, value);
        return value;
    }

    words() {
        const allWords = [];
        for (const spelling of this.bindings.keys()) {
            allWords.push(new Word(spelling));
        }
        return new Block(allWords);
    }

    copy(targetContext) {
        for (const [word, value] of this.bindings.entries()) {
            if (word === this.keyFor("self")) continue;
            console.log("word: ", word);
            console.log("value: ", value);
            targetContext.set(word, value);
        }
    }

    project(words) {
        const newContext = new this.constructor();
        for (const word of words.items) {
            if (word === this.keyFor("self")) continue;
            newContext.set(word, this.get(word));
        }
        return newContext;
    }

    merge(contexts) {
        const newContext = new this.constructor();
        this.copy(newContext);
        for (const ctx of contexts.items) {
            ctx.copy(newContext);
        }
        return newContext;
    }
}

export class ContextChain extends ContextBase {
    static type = normalize("context!");
    constructor(parent = nil) {
        super();
        if (parent !== nil) {
            this.set("parent", parent);
        }
    }

    hasParent() {
        return this.bindings.has(this.keyFor("parent"));
    }

    parent() {
        if (this.has("parent")) {
            return this.get("parent");
        }
        return nil;
    }

    get(word) {
        const key = this.keyFor(word);
        if (this.bindings.has(key)) return this.bindings.get(key);
        if (this.hasParent()) {
            return this.parent().get(word);
        }
        return nil;
    }
}

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

export function setMany(ctx, obj) {
    for (const [key, value] of Object.entries(obj)) {
        ctx.set(key, value);
    }
}

const parent = new ContextBase();

const a = new ContextChain(parent);
setMany(a, {
    a: { value: 123 },
    b: { value: 456 },
});

const b = new ContextChain(parent);
setMany(b, {
    b: { value: 123 },
    c: { value: 123123 },
});

const merged = a.merge(new Block([b]));

const parentRef = merged.get("parent");
parentRef.set("foo", { value: 123 });
console.log(a.get("foo"));
console.log(b.get("foo"));

const projected = merged.project(
    new Block(
        ["a", "b"].map((e) => new Word(e)),
    ),
);

console.log(projected.get("foo"));
