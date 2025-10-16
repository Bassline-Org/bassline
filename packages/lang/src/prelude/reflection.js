import { native } from "../datatypes/functions.js";
import { evalNext } from "../evaluator.js";

export function installReflection(context) {
    // print <value>
    // Print a value to console
    context.set(
        "print",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            console.log(value);
            return value;
        }),
    );

    // mold <value>
    // Serialize a value to valid Bassline code
    context.set(
        "mold",
        native(async (stream, context) => {
            // Evaluate the argument to get the actual value
            const value = await evalNext(stream, context);
            return value?.mold ? value.mold() : String(value);
        }),
    );
}
