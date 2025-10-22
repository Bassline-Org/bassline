import { Stream } from "./stream.js";
import { Block, Paren, unset } from "./prelude/index.js";

export function evaluate(code, context) {
    if (!(code instanceof Block) && !(code instanceof Paren)) {
        return evaluate(new Block([code]), context);
    }
    if (code.items.length === 0) {
        return unset;
    }

    const stream = new Stream(code.items);

    let result = unset;
    do {
        try {
            result = stream.next().evaluate(stream, context);
        } catch (error) {
            console.error("Error: ", error);
            console.error(
                `Error near: ${stream?.current()?.form?.()?.value ?? stream}`,
            );
            console.error(error);
            throw error;
        }
    } while (!stream.isAtEnd());
    return result;
}
