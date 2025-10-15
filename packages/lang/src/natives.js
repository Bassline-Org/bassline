import { isa } from "./utils.js";
import { Block, Num, Str, Word } from "./values.js";

// Helper to create native callable functions
// Optionally accepts metadata: { doc, args, examples }
export function native(fn, metadata) {
    const nativeObj = {
        call(stream, context) {
            return fn(stream, context);
        },
    };

    // Attach metadata as Symbol properties if provided
    if (metadata) {
        if (metadata.doc) {
            nativeObj[Symbol.for("DOC")] = metadata.doc;
        }
        if (metadata.args) {
            nativeObj[Symbol.for("ARGS")] = metadata.args;
        }
        if (metadata.examples) {
            nativeObj[Symbol.for("EXAMPLES")] = metadata.examples;
        }
    }

    return nativeObj;
}

// Evaluate a value - resolve words, extract scalars
export function evalValue(val, context) {
    // Resolve words first
    if (isa(val, Word)) {
        val = context.get(val.spelling);
    }

    // Then unwrap scalars
    if (isa(val, Num)) {
        return val.value;
    }
    if (isa(val, Str)) {
        return val.value;
    }
    if (isa(val, Block)) {
        return val; // Blocks stay as blocks
    }
    return val;
}
