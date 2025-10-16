import { Context } from "./context.js";

// Import evaluator functions
export { evalNext, ex } from "./evaluator.js";

// Import all standard library modules
import { installArithmetic } from "./prelude/arithmetic.js";
import { installComparison } from "./prelude/comparison.js";
import { installControlFlow } from "./prelude/control-flow.js";
import { installContextOps } from "./prelude/context-ops.js";
import { installFunctions } from "./prelude/functions.js";
import { installTypes } from "./prelude/types.js";
import { installStrings } from "./prelude/strings.js";
//import { installHttp } from "./prelude/http.js";
//import { installJson } from "./prelude/json.js";
import { installReflection } from "./prelude/reflection.js";
//import { installView } from "./prelude/view.js";
//import { installGadgets } from "./prelude/gadgets.js";
//import { installDialects } from "./prelude/dialects.js";
import { installAsyncOps } from "./prelude/async-ops.js";
//import { installContactOps } from "./prelude/contact-ops.js";
//import { installRemoteOps } from "./prelude/remote-ops.js";
import { installArrayOps } from "./prelude/array-ops.js";
import { evalNext, ex } from "./evaluator.js";
import { native } from "./natives.js";

// Create a prelude context with built-in natives
export function createPreludeContext() {
    const context = new Context();
    installArrayOps(context);
    installArithmetic(context);
    installComparison(context);
    installControlFlow(context);
    installContextOps(context);
    installFunctions(context);
    installTypes(context);
    installReflection(context);
    installStrings(context);
    installAsyncOps(context);

    // Special values
    context.set("true", true);
    context.set("false", false);
    context.set("none", null);
    // system - reference to the prelude context itself
    context.set("system", context);
    context.set(
        "ex",
        native(async (stream, context) => {
            const code = await evalNext(stream, context);
            return await ex(context, code);
        }),
    );

    return context;
}
