import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, LitWord, Word } from "../values.js";

export function installFunctions(context) {
    // func <args-block> <body-block>
    // Create a function context
    context.set(
        "func",
        native(async (stream, context) => {
            const argsBlock = stream.next();
            const bodyBlock = stream.next();

            if (!isa(argsBlock, Block)) {
                throw new Error("func expects a block of arguments");
            }
            if (!isa(bodyBlock, Block)) {
                throw new Error("func expects a body block");
            }

            // Create function context extending current scope
            const funcContext = new Context(context);
            funcContext._function = true;
            funcContext._argNames = [];
            funcContext._argEval = []; // Track which args to evaluate

            // Process argument list
            const argStream = argsBlock.stream();
            while (!argStream.done()) {
                const arg = argStream.next();

                if (isa(arg, LitWord)) {
                    // 'x - literal arg, don't evaluate
                    funcContext.set(arg.spelling, null);
                    funcContext._argNames.push(arg.spelling);
                    funcContext._argEval.push(false);
                } else if (isa(arg, Word)) {
                    // x - normal arg, evaluate
                    funcContext.set(arg.spelling, null);
                    funcContext._argNames.push(arg.spelling);
                    funcContext._argEval.push(true);
                } else {
                    throw new Error(
                        `Invalid argument in func: ${arg.constructor.name}`,
                    );
                }
            }

            // Store body using Symbol (consistent with evaluator)
            funcContext.set(Symbol.for("BODY"), bodyBlock);

            // Support for documentation
            // Functions can have doc and examples set in their body
            funcContext.set(Symbol.for("DOC"), null);
            funcContext.set(Symbol.for("EXAMPLES"), null);

            return funcContext;
        }),
    );
}
