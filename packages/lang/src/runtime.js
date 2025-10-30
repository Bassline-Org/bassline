import defaultSemantics from "./semantics/default/index.js";
import { ContextBase, setMany } from "./semantics/default/contexts.js";
import wsClient from "./io/ws-client.js";
import { parse } from "./parser.js";
import { evaluateBlock } from "./semantics/default/evaluate.js";

export function createRuntime() {
    const context = new ContextBase();
    context.set("system", context);
    setMany(context, { ...defaultSemantics, ...wsClient });
    return {
        context,
        evaluate: (code) => {
            if (typeof code === "string") {
                const ast = parse(code);
                return evaluateBlock(ast, context);
            }
            return evaluateBlock(code, context);
        },
    };
}

export const GLOBAL = createRuntime();
