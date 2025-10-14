import { native, evalValue } from "../natives.js";
import { isa } from "../utils.js";
import { Str } from "../values.js";
import { evalNext } from "../evaluator.js";
import { jsToBassline, basslineToJs } from "./helpers.js";

export function installJson(context) {
    // parse-json <str>
    // Parse JSON string into Bassline values
    context.set(
        "parse-json",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const jsonStr = isa(str, Str) ? str.value : String(str);

            try {
                const parsed = JSON.parse(jsonStr);
                return jsToBassline(parsed, context);
            } catch (error) {
                throw new Error(`parse-json failed: ${error.message}`);
            }
        }),
    );

    // to-json <value>
    // Convert Bassline value to JSON string
    context.set(
        "to-json",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            const jsValue = basslineToJs(value);
            return new Str(JSON.stringify(jsValue));
        }),
    );
}
