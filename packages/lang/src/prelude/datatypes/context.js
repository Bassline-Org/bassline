import { normalize } from "../../utils.js";
import { Block, datatype, LitWord, Str, Value, Word } from "./core.js";
import { collectArguments, nativeFn } from "./functions.js";
import { TYPES, WORD_TYPES } from "./types.js";

export const keys = {
    self: normalize("self"),
    parent: normalize("parent"),
    emit: normalize("emit"),
    on: normalize("on"),
};

export class ContextBase extends Value.typed(TYPES.context) {
    constructor() {
        super(new Map());
        this.set(keys.self, this);
        this.set(
            keys.emit,
            nativeFn("kind value", (kind, value) => {
                this.emitter.dispatchEvent(
                    new CustomEvent(kind.to(TYPES.string).value, {
                        detail: value,
                    }),
                );
                return this;
            }),
        );
    }
    get emitter() {
        if (this._emitter) return this._emitter;
        this._emitter = new EventTarget();
        return this._emitter;
    }
    get bindings() {
        return this.value;
    }

    doBlock(block) {
        return block.to(TYPES.block).doBlock(this);
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
            Array.from(this.bindings.keys()).map((key) => new LitWord(key)),
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
        return result ? new Word("true") : new Word("false");
    }

    delete(word) {
        const spelling = this.keyFor(word);
        if (!this.bindings.has(spelling)) {
            return new Word("false");
        }
        this.bindings.delete(spelling);
        return new Word("true");
    }

    get(word) {
        const spelling = this.keyFor(word);
        const value = this.bindings.get(spelling);
        if (!value) {
            console.error("Key not found in context: ", spelling.description);
            throw new Error(
                `Key not found in context: ${spelling.description}`,
            );
            //return new Condition(normalize(`key-not-found`));
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
            entries.push(
                `${key.description}: ${JSON.stringify(value)}`,
            );
        }
        return new Str(`
context! [
    ${entries.join("\n  ")}
]`);
    }

    moldEntries() {
        return this.relevantEntries().map(([key, value]) =>
            `${key.description}: ${value.mold()}`
        ).join("\n");
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
            parts.push(`    ${key.description}: ${value.mold()}`);
        }
        return `in (clone system) [ \n  ${parts.join("\n  ")} \n  self ]`;
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

    mold() {
        const formed = [];
        for (const [key, value] of this.bindings.entries()) {
            if (key === keys.self) continue;
            if (key === keys.parent) continue;
            formed.push(`    ${key.description}: ${value.mold()}`);
        }
        return `in (make context-chain! self) [ \n  ${
            formed.join("\n  ")
        } \n  self ]`;
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

    static make(parent) {
        return new ContextChain(parent);
    }
}

export class PureFn extends ContextChain.typed(TYPES.fn) {
    constructor(spec, body, parent) {
        super(parent);
        this.set("spec", spec);
        this.set("body", body);
    }
    evaluate(context, iter) {
        //try {
        const localCtx = new ContextChain(context);
        const spec = this.get("spec");
        const body = this.get("body");
        const args = collectArguments(spec.items, localCtx, iter);
        args.forEach((arg, index) => {
            localCtx.set(spec.items[index], arg);
        });
        return body.doBlock(localCtx);
        //} catch (error) {
        //    const condition = new Condition(normalize("error"));
        //    return condition.evaluate(context, iter);
        //}
    }
    mold() {
        const args = this.get("spec");
        const body = this.get("body");
        return `(make fn! [${args.mold()} ${body.mold()}])`;
    }
    static make(value, context) {
        if (value.type !== TYPES.block) {
            throw new Error("Invalid value for make");
        }
        const [args, body] = value.items;
        return new PureFn(args, body, context);
    }
}

export class Uri extends ContextBase.typed(TYPES.uri) {
    constructor({ scheme, userinfo, host, port, path, query, fragment }) {
        super();
        if (scheme) this.set("scheme", scheme);
        if (userinfo) this.set("userinfo", userinfo);
        if (host) this.set("host", host);
        if (port) this.set("port", port);
        if (path) this.set("path", path);
        if (query) this.set("query", query);
        if (fragment) this.set("fragment", fragment);
    }

    mold() {
        // Build the URL string from its components
        let url = "";

        // Scheme is required
        const scheme = this.get("scheme");
        url += scheme.mold().toLowerCase();
        url += ":";

        // Authority section (host is required if using //)
        if (this.has("host").value) {
            url += "//";

            // Optional userinfo
            if (this.has("userinfo").value) {
                const userinfo = this.get("userinfo");
                url += userinfo.value;
                url += "@";
            }

            // Host
            const host = this.get("host");
            // Check if it's IPv6 (contains colons)
            const hostStr = host.mold().toLowerCase();
            if (hostStr.includes(":")) {
                url += "[" + hostStr + "]";
            } else {
                url += hostStr;
            }

            // Optional port
            if (this.has("port").value) {
                const port = this.get("port");
                url += ":" + port.value;
            }
        }

        // Path (can exist with or without authority)
        if (this.has("path").value) {
            const path = this.get("path");
            url += path.value;
        }

        // Optional query
        if (this.has("query").value) {
            const query = this.get("query");
            url += "?" + query.value;
        }

        // Optional fragment
        if (this.has("fragment").value) {
            const fragment = this.get("fragment");
            url += "#" + fragment.value;
        }

        return url;
    }

    form() {
        // form() returns a Str object with the molded representation
        return new Str(this.mold());
    }
}

export const context = () => new ContextBase();
export const contextChain = (parent) => new ContextChain(parent);
export const uri = (value) => new Uri(value);
export const pureFn = (spec, body, parent) => new PureFn(spec, body, parent);

export function setMany(context, bindingObj) {
    for (const [key, value] of Object.entries(bindingObj)) {
        context.set(key, value);
    }
    return context;
}

export function getMany(context, keys) {
    return keys.map((key) => context.get(key));
}

export default {
    "context!": datatype(ContextBase),
    "context-chain!": datatype(ContextChain),
    "on": nativeFn("target kind fn", (target, kind, fn, context) => {
        const kindStr = kind.to(TYPES.string).value;
        const handler = (event) => {
            new Block([fn, event.detail]).doBlock(context);
        };
        target.emitter.addEventListener(
            kindStr,
            handler,
        );
        return nativeFn("", () => {
            target.emitter.removeEventListener(
                kindStr,
                handler,
            );
            return new Word("true");
        });
    }),
    "fn!": datatype(PureFn),
    "uri!": datatype(Uri),
};
