import { normalize } from "../../utils.js";
import { Block, Bool, Condition, datatype, Str, Value, Word } from "./core.js";
import { TYPES, WORD_TYPES } from "./types.js";

export const keys = {
    self: normalize("self"),
    parent: normalize("parent"),
};

export class ContextBase extends Value.typed(TYPES.context) {
    constructor() {
        super(new Map());
        this.set(keys.self, this);
    }
    get bindings() {
        return this.value;
    }

    relevantEntries() {
        return Array.from(
            this.bindings.entries().filter(([key, value]) => {
                return !(
                    value.type === TYPES.nativeFn ||
                    value.type === TYPES.datatype ||
                    value.type === TYPES.bool ||
                    key === keys.self ||
                    key === keys.parent
                );
            }),
        );
    }

    values() {
        return new Block(this.relevantEntries().map(([key, value]) => value));
    }

    keys() {
        return new Block(
            this.relevantEntries().map(([key, value]) => new Word(key)),
        );
    }

    keyFor(word) {
        if (typeof word === "symbol") return word;
        if (typeof word === "string") return normalize(word);
        if (WORD_TYPES.has(word.type)) return word.spelling;
        if (word.type === TYPES.string) return normalize(word.value);
        console.error("Invalid word: ", word);
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
        if (!value) {
            return new Condition(normalize(`key-not-found`));
        }
        return value;
    }

    set(word, value) {
        const spelling = this.keyFor(word);
        this.bindings.set(spelling, value);
        return value;
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
        for (const word of words.iter()) {
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
        for (const ctx of contexts.iter()) {
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
                value.type === TYPES.nativeFn ||
                value.type === TYPES.nativeMethod ||
                value.type === TYPES.datatype ||
                value.type === TYPES.bool ||
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

export class ContextChain extends ContextBase.typed(TYPES.contextChain) {
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
        if (!p) {
            throw new Error(`Parent not found in context chain`);
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
        console.error("Key not found in context chain: ", key);
        throw new Error(`Key not found in context chain`);
    }

    static make(parent, context) {
        return new ContextChain(parent);
    }
}

export const context = () => new ContextBase();
export const contextChain = (parent) => new ContextChain(parent);

export function setMany(context, bindingObj) {
    for (const [key, value] of Object.entries(bindingObj)) {
        context.set(key, value);
    }
    return context;
}

export default {
    "context!": datatype(ContextBase),
    "context-chain!": datatype(ContextChain),
};
