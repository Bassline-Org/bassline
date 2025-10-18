import { Stream } from "./stream.js";
import { Block, nil, Paren } from "./datatypes/core.js";

export function evaluate(code, context) {
    if (!(code instanceof Block) && !(code instanceof Paren)) {
        return evaluate(new Block([code]), context);
    }
    if (code.items.length === 0) {
        return nil;
    }
    const stream = new Stream(code.items);
    if (code.items.length === 1) {
        return code.items[0].evaluate(stream, context);
    }

    let result = null;
    while (!stream.isAtEnd()) {
        result = stream.next().evaluate(stream, context);
    }
    return result;
}
