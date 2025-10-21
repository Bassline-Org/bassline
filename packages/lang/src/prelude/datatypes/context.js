import { normalize, normalizeString } from "../../utils.js";
import { Block, Bool, Datatype, Nil, nil, Str, Value, Word } from "./core.js";
import { NativeFn, NativeMethod } from "./functions.js";

export class ContextBase extends Value {
    static type = normalizeString("context!");
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
        throw new Error(`Invalid string ${JSON.stringify(word)}`);
    }

    has(word) {
        const spelling = this.keyFor(word);
        const result = this.bindings.has(spelling);
        return new Bool(result);
    }

    delete(word) {
        const spelling = this.keyFor(word);
        this.bindings.delete(spelling);
        return this;
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

    fresh() {
        return new this.constructor();
    }

    clone() {
        return this.copy(this.fresh());
    }

    copy(targetContext = this.clone()) {
        for (const [word, value] of this.bindings.entries()) {
            if (word === this.keyFor("self")) continue;
            targetContext.set(word, value);
        }
        return targetContext;
    }

    project(words) {
        const newContext = this.fresh();
        for (const word of words.items) {
            if (word === this.keyFor("self")) continue;
            newContext.set(word, this.get(word));
        }
        return newContext;
    }

    rename(oldWords, newWords) {
        const newContext = this.clone();
        this.copy(newContext);
        for (let i = 0; i < oldWords.items.length; i++) {
            newContext.set(newWords.items[i], this.get(oldWords.items[i]));
            newContext.delete(oldWords.items[i]);
        }
        return newContext;
    }

    merge(contexts) {
        const newContext = this.clone();
        for (const ctx of contexts.items) {
            ctx.copy(newContext);
        }
        return newContext;
    }

    form() {
        const entries = [];
        for (const [key, value] of this.bindings.entries()) {
            if (value === this) {
                entries.push(`${key.description}: <self>`);
                continue;
            }
            entries.push(`${key.description}: ${value.form().value}`);
        }
        return new Str(`
context! [
    ${entries.join("\n  ")}
]`);
    }

    moldEntries() {
        const parts = [];
        for (const [key, value] of this.bindings) {
            if (
                value instanceof NativeFn ||
                value instanceof NativeMethod ||
                value instanceof Datatype ||
                value instanceof Bool ||
                value instanceof Nil ||
                key === this.keyFor("self") ||
                key === this.keyFor("parent")
            ) {
                continue;
            }
            parts.push(`${key.description}: ${value.mold().value}`);
        }
        return parts.join("\n  ");
    }

    mold() {
        const parts = [];
        const natives = [];
        for (const [key, value] of this.bindings) {
            if (
                value instanceof NativeFn ||
                value instanceof NativeMethod ||
                value instanceof Datatype ||
                value instanceof Bool ||
                value instanceof Nil ||
                key === this.keyFor("self") ||
                key === this.keyFor("parent")
            ) continue; // TODO: Push the missing natives into a projection from system
            // IE in (project system [<MISSING_NATIVES>] <Block>)
            if (value === this) continue;
            parts.push(`${key.description}: ${value.mold().value}`);
        }
        return new Str(`in (clone system) [
        ${parts.join("  \n")}
        self
        ]`);
    }

    static make(stream, context) {
        return new ContextBase();
    }
}

export class ContextChain extends ContextBase {
    static type = normalizeString("context-chain!");
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
        const p = this.bindings.get(this.keyFor("parent"));
        if (p === undefined) {
            return nil;
        }
        return p;
    }

    form() {
        const formed = [];
        for (const [key, value] of this.bindings.entries()) {
            if (value === this) {
                formed.push(`${key.description}: <self>`);
                continue;
            }
            if (key === this.keyFor("parent")) {
                formed.push(`${key.description}: <parent>`);
                continue;
            }
            formed.push(`${key.description}: ${value.form().value}`);
        }
        return new Str(`context-chain! [${formed.join("\n  ")}]`);
    }

    copy(targetContext = this.clone()) {
        for (const [key, value] of this.bindings.entries()) {
            if (key === this.keyFor("self")) continue;
            if (key === this.keyFor("parent")) continue;
            targetContext.set(key, value);
        }
        return targetContext;
    }

    fresh() {
        return new this.constructor(this);
    }

    get(word) {
        const key = this.keyFor(word);
        if (this.bindings.has(key)) return this.bindings.get(key);
        if (this.hasParent()) {
            const p = this.parent();
            return p.get(word);
        }
        return nil;
    }

    static make(stream, context) {
        const parent = stream.next().evaluate(stream, context);
        return new ContextChain(parent);
    }
}

export default {
    "context!": new Datatype(ContextBase),
    "context-chain!": new Datatype(ContextChain),
};

export function setMany(context, bindingObj) {
    for (const [key, value] of Object.entries(bindingObj)) {
        context.set(key, value);
    }
    return context;
}
