import prelude from "./prelude/index.js";
import { Context } from "./datatypes/context.js";
import { evaluate } from "./evaluator.js";

export function createRuntime() {
    const context = new Context();
    context.setMany(prelude);
    context.set("system", context);
    return {
        context,
        evaluate: (code) => {
            return evaluate(code, context);
        },
    };
}

export const GLOBAL = createRuntime();
