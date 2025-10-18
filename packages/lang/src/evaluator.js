import { Stream } from "./stream.js";

export function evaluate(code, context) {
    const stream = new Stream(code.items);
    let result = null;
    while (!stream.isAtEnd()) {
        result = stream.next().evaluate(stream, context);
    }
    return result;
}
