import { ContextChain } from "./context.js";
import { Block, Datatype, Value } from "./core.js";
import * as t from "./types.js";
const { TYPES } = t;

export class MissingHandler extends Error {
    constructor(condition, iter) {
        super(`No handler found for condition: ${condition.type.description}`);
        this.condition = condition;
        this.iter = iter;
    }
}

export class Condition extends ContextChain.typed(TYPES.condition) {
    constructor(type, context) {
        super(context);
        this.set("type", type);
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
        throw new MissingHandler(this, iter);
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
