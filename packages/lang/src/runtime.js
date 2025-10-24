import prelude from "./prelude/index.js";
import { ContextBase, setMany } from "./prelude/datatypes/context.js";
//import wsClient from "./io/ws-client.js";
import { parse } from "./parser.js";

export function createRuntime() {
    const context = new ContextBase();
    context.set("system", context);
    setMany(context, {
        ...prelude,
        //      ...wsClient,
    });
    console.log(context);
    return {
        context,
        evaluate: (code) => {
            return code.doBlock(context);
        },
    };
}

export const GLOBAL = createRuntime();
