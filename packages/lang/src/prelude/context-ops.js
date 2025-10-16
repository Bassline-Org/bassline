import { native } from "../datatypes/functions.js";
import { Context } from "../datatypes/context.js";
import { isa } from "../utils.js";
import { Block } from "../datatypes/core.js";
import { evalNext, ex } from "../evaluator.js";

export function installContextOps(context) {
    // context <aBlock>
    context.set(
        "context",
        native(async (stream, context) => {
            const block = await evalNext(stream, context);
            if (!isa(block, Block)) {
                throw new Error("context expects a block as argument");
            }
            const ctx = new Context(context);
            await ex(ctx, block);
            return ctx;
        }),
    );

    // in <context> <block>
    // Evaluate block in the given context
    context.set(
        "in",
        native(async (stream, context) => {
            const targetContext = await evalNext(stream, context);
            const block = await evalNext(stream, context);

            if (!isa(block, Block)) {
                throw new Error("in expects a block as second argument");
            }

            return await ex(targetContext, block);
        }),
    );
}
