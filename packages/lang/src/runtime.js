import prelude from "./prelude/index.js";
import { ContextBase, setMany } from "./prelude/datatypes/context.js";
import { evaluate } from "./evaluator.js";
import wsClient from "./io/ws-client.js";

export function createRuntime() {
    const context = new ContextBase();
    context.set("system", context);
    setMany(context, {
        ...prelude,
        ...wsClient,
    });
    return {
        context,
        evaluate: (code) => {
            return evaluate(code, context);
        },
    };
}

export const GLOBAL = createRuntime();
