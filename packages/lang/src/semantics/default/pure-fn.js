import { Block, Datatype } from "./datatypes/core.js";
import { TYPES } from "./datatypes/types.js";
import { ContextChain } from "./contexts.js";
import { takeN } from "./functions.js";
import { makeState, runUntilDone } from "./state.js";
import { doSemantics } from "./dialect.js";

/**
 * PureFn - user-defined functions that extend ContextChain.
 * Functions are contexts that store their spec and body.
 * Removed evaluate() method - dialects handle function invocation.
 */
export class PureFn extends ContextChain.typed(TYPES.fn) {
    constructor(spec, body, parent) {
        super(parent);
        this.set("spec", spec);
        this.set("body", body);
    }

    /**
     * Get the function spec.
     * @returns {Block} The spec block
     */
    getSpec() {
        return this.get("spec");
    }

    /**
     * Get the function body.
     * @returns {Block} The body block
     */
    getBody() {
        return this.get("body");
    }

    /**
     * Invoke this function using the state machine evaluator.
     * This is called by the dialect's fn handler.
     * @param {import("./state.js").EvaluationState} state - Current evaluation state
     * @param {*} ctx - Evaluation context
     * @param {Function} k - Continuation callback
     * @returns {import("./state.js").EvaluationState|import("./state.js").EvaluationResult}
     */
    invoke(state, ctx, k) {
        const localCtx = new ContextChain(ctx);
        const spec = this.getSpec();
        const body = this.getBody();

        // Ensure spec and body are Blocks with items
        if (!spec) {
            throw new Error(`PureFn spec is undefined`);
        }
        if (!body) {
            throw new Error(`PureFn body is undefined`);
        }
        if (spec.type !== TYPES.block) {
            const typeDesc = typeof spec.type === "symbol"
                ? spec.type.description
                : String(spec.type);
            throw new Error(`PureFn spec must be a block, got ${typeDesc}`);
        }
        if (body.type !== TYPES.block) {
            const typeDesc = typeof body.type === "symbol"
                ? body.type.description
                : String(body.type);
            throw new Error(`PureFn body must be a block, got ${typeDesc}`);
        }

        // Get items from spec and body - handle both .items and .value properties
        const specItems = spec.items !== undefined
            ? spec.items
            : (spec.value !== undefined ? spec.value : []);
        const bodyItems = body.items !== undefined
            ? body.items
            : (body.value !== undefined ? body.value : []);

        // Ensure we have arrays
        if (!Array.isArray(specItems)) {
            throw new Error(
                `PureFn spec items must be an array, got ${typeof specItems}`,
            );
        }
        if (!Array.isArray(bodyItems)) {
            throw new Error(
                `PureFn body items must be an array, got ${typeof bodyItems}`,
            );
        }

        // Use takeN to collect arguments according to spec
        // Convert spec block items to spec string
        const specString = specItems.map((e) => e.mold()).join(" ");

        const { values, state: nextState } = takeN(state, specString);

        // Set arguments in local context using spec items as keys
        values.forEach((arg, index) => {
            const argName = specItems[index];
            if (argName) {
                localCtx.set(argName.spelling, arg);
            } else {
                throw new Error("PureFn: argument name is undefined", {
                    cause: arg.mold(),
                    spec: specString,
                });
            }
        });

        // Evaluate body block using state machine
        let result;
        let currentItems = bodyItems;
        while (currentItems.length > 0) {
            const bodyState = makeState(
                currentItems,
                localCtx,
                [],
                doSemantics,
            );
            const evalResult = runUntilDone(bodyState);
            currentItems = evalResult.rest ?? [];
            result = evalResult.value;
        }

        return k(result, nextState);
    }

    mold() {
        const args = this.getSpec();
        const body = this.getBody();
        return `(make fn! [${args.mold()} ${body.mold()}])`;
    }

    static make(value, context) {
        if (value.type !== TYPES.block) {
            throw new Error(
                `PureFn.make expects a block, got ${
                    typeof value.type === "symbol"
                        ? value.type.description
                        : String(value.type)
                }`,
            );
        }
        const items = value.items || value.value || [];
        if (items.length < 2) {
            throw new Error(
                `PureFn.make expects a block with [spec body], got ${items.length} items`,
            );
        }
        const [specItem, bodyItem] = items;

        // Both specItem and bodyItem must be blocks
        // The correct syntax is: make fn! [[x y] [ + x y ]]
        // Nested blocks are NOT evaluated during block evaluation - they pass through as literals
        // So make fn! [[args body] [body code]] receives literal blocks [args body] and [body code]
        if (!specItem || specItem.type !== TYPES.block) {
            const typeDesc = specItem && typeof specItem.type === "symbol"
                ? specItem.type.description
                : (specItem ? String(specItem.type) : "undefined");
            throw new Error(
                `PureFn.make: spec must be a block, got ${typeDesc}. Usage: make fn! [[args...] [body...]]`,
            );
        }
        if (!bodyItem || bodyItem.type !== TYPES.block) {
            const typeDesc = bodyItem && typeof bodyItem.type === "symbol"
                ? bodyItem.type.description
                : (bodyItem ? String(bodyItem.type) : "undefined");
            throw new Error(
                `PureFn.make: body must be a block, got ${typeDesc}. Usage: make fn! [[args...] [body...]]`,
            );
        }

        return new PureFn(specItem, bodyItem, context);
    }
}

export const pureFn = (spec, body, parent) => new PureFn(spec, body, parent);

export default {
    "fn!": new Datatype(PureFn),
};
