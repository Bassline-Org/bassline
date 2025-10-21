import prelude from "./prelude/index.js";
import { ContextBase, setMany } from "./prelude/datatypes/context.js";
import { evaluate } from "./evaluator.js";
import io from "./io/index.js";

export function createRuntime() {
    const context = new ContextBase();
    setMany(context, prelude);
    setMany(context, io);
    context.set("system", context);
    return {
        context,
        evaluate: (code) => {
            return evaluate(code, context);
        },
    };
}

export const GLOBAL = createRuntime();
