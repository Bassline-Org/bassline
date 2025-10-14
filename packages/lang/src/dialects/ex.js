import { Context } from "../context.js";
import { parse } from "../parser.js";
import { isa, isSelfEvaluating } from "../utils.js";
import { Block, Compound, Paren, Scalar, SetWord, Word } from "../values.js";

function internalEx(context, code) {
    if (isSelfEvaluating(code)) {
        return code;
    }
    if (isa(code, SetWord)) {
        throw new Error(
            "Invalid set word use!",
        );
    }
    if (isa(code, Word)) {
        return context.get(code.spelling);
    }
    throw new Error("How??");
}

/// Main execution function
/// Executes a block as code, in the current context
export function ex(context, code) {
    if (!isa(code, Block)) {
        throw new Error(
            "ex, can only be called with a block! Received: ",
            code,
        );
    }
    let result;
    let stream = code.stream();
    while (!stream.done()) {
        const c = stream.next();
        if (isSelfEvaluating(c)) {
            result = c;
            continue;
        }
        if (isa(c, SetWord)) {
            result = internalEx(context, stream.next());
            context.set(c.spelling, result);
            continue;
        }
        if (isa(c, Word)) {
            result = context.get(c.spelling);
            continue;
        }
    }
    return result;
}

const example = `
    foo: 123
    bar: 123
    bar
`;

const context = new Context();
const parsed = parse(example);
const result = ex(context, parsed);
console.log(result);
