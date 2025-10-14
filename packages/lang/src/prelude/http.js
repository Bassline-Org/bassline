import { native, evalValue } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Num, Str } from "../values.js";
import { evalNext } from "../evaluator.js";

export function installHttp(context) {
    // fetch <url>
    // HTTP GET request, returns response body as string
    context.set(
        "fetch",
        native(async (stream, context) => {
            const url = evalValue(stream.next(), context);
            const urlStr = isa(url, Str) ? url.value : String(url);

            try {
                const response = await fetch(urlStr);
                const text = await response.text();
                return new Str(text);
            } catch (error) {
                throw new Error(`fetch failed: ${error.message}`);
            }
        }),
    );

    // post <url> <data>
    // HTTP POST request with JSON body
    context.set(
        "post",
        native(async (stream, context) => {
            const url = evalValue(stream.next(), context);
            const data = await evalNext(stream, context);

            const urlStr = isa(url, Str) ? url.value : String(url);

            // Convert data to JSON
            let body;
            if (data instanceof Context) {
                const obj = {};
                for (const [sym, value] of data.bindings) {
                    obj[sym.description] = isa(value, Num)
                        ? value.value
                        : isa(value, Str)
                        ? value.value
                        : value;
                }
                body = JSON.stringify(obj);
            } else {
                body = JSON.stringify(data);
            }

            try {
                const response = await fetch(urlStr, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body,
                });
                const text = await response.text();
                return new Str(text);
            } catch (error) {
                throw new Error(`post failed: ${error.message}`);
            }
        }),
    );
}
