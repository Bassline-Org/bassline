import { normalize, normalizeString } from "../../utils.js";
import {
    Block,
    Bool,
    Datatype,
    LitWord,
    Str,
    Unset,
    unset,
    Value,
    Word,
    WordLike,
} from "./core.js";
import { isCallable } from "./functions.js";

export const keys = {
    self: normalize("self"),
    parent: normalize("parent"),
};

export class ContextBase extends Value {
    static type = normalizeString("context!");
    constructor() {
        super();
        this.bindings = new Map();
        this.set(keys.self, this);
    }

    relevantEntries() {
        return this.bindings.entries().filter(([key, value]) => {
            return !(
                isCallable(value) ||
                value.is(Datatype) ||
                value.is(Bool) ||
                value.is(Unset) ||
                key === keys.self ||
                key === keys.parent
            );
        });
    }

    values() {
        return new Block(this.relevantEntries().map(([key, value]) => value));
    }

    keys() {
        return new Block(
            this.relevantEntries().map(([key, value]) => new LitWord(key)),
        );
    }

    keyFor(word) {
        if (typeof word === "symbol") return word;
        if (typeof word === "string") return normalize(word);
        if (word.is(WordLike)) return word.spelling;
        if (word.is(Str)) return normalize(word.value);
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
            return unset;
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
            if (word === keys.self) continue;
            targetContext.set(word, value);
        }
        return targetContext;
    }

    project(words) {
        const newContext = this.fresh();
        for (const word of words.items) {
            if (word === keys.self) continue;
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
        return this.relevantEntries().map(([key, value]) =>
            `${key.description}: ${value.mold().value}`
        ).join("\n  ");
    }

    mold() {
        const parts = [];
        const natives = [];
        for (const [key, value] of this.bindings) {
            if (
                isCallable(value) ||
                value instanceof Datatype ||
                value instanceof Bool ||
                value instanceof Unset ||
                key === keys.self ||
                key === keys.parent
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
    constructor(parent) {
        super();
        if (parent) {
            this.set(keys.parent, parent);
        }
    }

    hasParent() {
        return this.bindings.has(keys.parent);
    }

    parent() {
        const p = this.bindings.get(keys.parent);
        if (!p) return unset;
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
            if (key === keys.self) continue;
            if (key === keys.parent) continue;
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
        return unset;
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
