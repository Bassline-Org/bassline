import prelude from "./prelude/index.js";
import { ContextBase, setMany } from "./prelude/datatypes/context.js";
import wsClient from "./io/ws-client.js";
import { parse } from "./parser.js";

export function createRuntime() {
    const context = new ContextBase();
    context.set("system", context);
    context.set("ws-client", wsClient);
    setMany(context, prelude);
    return {
        context,
        evaluate: (code) => {
            if (typeof code === "string") {
                return parse(code).doBlock(context);
            }
            return code.doBlock(context);
        },
    };
}

export const GLOBAL = createRuntime();
