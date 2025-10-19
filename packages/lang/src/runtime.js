import prelude from "./prelude/index.js";
import { ContextBase, setMany } from "./datatypes/context.js";
import { evaluate } from "./evaluator.js";

export function createRuntime() {
    const context = new ContextBase();
    setMany(context, prelude);
    context.set("system", context);
    return {
        context,
        evaluate: (code) => {
            return evaluate(code, context);
        },
    };
}

export const GLOBAL = createRuntime();
