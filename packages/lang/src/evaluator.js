import { Stream } from "./stream.js";
import { Block, Paren, unset } from "./prelude/index.js";

export function evaluate(code, context) {
    if (!(code instanceof Block) && !(code instanceof Paren)) {
        throw new Error(
            `Invalid use of evaluate! Must be a block or paren, received: ${code}!`,
        );
    }
    return code.iter().reduce((acc, curr) => {
        return curr.evaluate(iter, context);
    }, null);
}
