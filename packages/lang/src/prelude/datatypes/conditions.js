import { normalize } from "../../utils.js";
import { ContextChain } from "./context.js";
import { Block, Datatype, LitWord, Value } from "./core.js";
import { nativeFn } from "./functions.js";
import * as t from "./types.js";
const { TYPES } = t;

export class MissingHandler extends Error {
    constructor(condition, iter) {
        super(`No handler found for condition: ${condition.type.description}`);
        this.condition = condition;
        this.iter = iter;
    }
}

const modes = {
    error: normalize("error"),
    warning: normalize("warning"),
    info: normalize("info"),
    debug: normalize("debug"),
    trace: normalize("trace"),
};

const error = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.error));
});
const warning = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.warning));
});
const info = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.info));
});

export class Condition extends ContextChain.typed(TYPES.condition) {
    constructor(type, context) {
        super(context);
        this.set("type", type);
        this.set("mode", new LitWord(modes.error));
        this.set("error-mode", error);
        this.set("warning-mode", warning);
        this.set("info-mode", info);
    }
    static make(type, context) {
        return new Condition(type, context);
    }
    evaluate(context, iter) {
        const type = this.get("type").to(TYPES.litWord);
        // Handlers are just blocks that will get evaluated in the context of the condition
        // They are expected to invoke restarts or somethin
        const handler = context.get(type);
        if (handler) {
            return handler.doBlock(this);
        }
        console.error(`No handler found for condition: `, this);
        const defaultHandler = context.get("#default-handler");
        if (defaultHandler) {
            return defaultHandler.doBlock(this);
        }
        const mode = this.get("mode");
        if (mode.spelling === modes.error) {
            throw new MissingHandler(this, iter);
        }
        if (mode.spelling === modes.warning) {
            console.warn(`Warning: ${this.get("type").value}`);
            return this;
        }
        if (mode.spelling === modes.info) {
            console.info(`Info: ${this.get("type").value}`);
            return this;
        }
    }

    moldBody() {
        return this.relevantEntries().map(([key, value]) => {
            return `${key.description}: ${value.mold()}`;
        }).join("\n  ");
    }

    mold() {
        return `(make condition! [${
            this.get("type").mold()
        } [${this.moldBody()}]])`;
    }

    static make(args, context, iter) {
        const [type, restartsBlock] = args.items;
        const condition = new Condition(type, context);
        restartsBlock.doBlock(condition, iter);
        return condition;
    }
}

export default {
    "condition!": new Datatype(Condition),
};
