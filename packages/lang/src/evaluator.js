import { Stream } from "./stream.js";

export function evaluate(code, context) {
    if (!(code instanceof Block)) {
        return evaluate(new Block([code]), context);
    }
    const stream = new Stream(code.items);
    let result = null;
    while (!stream.isAtEnd()) {
        result = stream.next().evaluate(stream, context);
    }
    return result;
}
