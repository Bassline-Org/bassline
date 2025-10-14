import { isa } from "./utils.js";
import { Block, Num, Str, Word } from "./values.js";

// Helper to create native callable functions
export function native(fn) {
    return {
        call(stream, context) {
            return fn(stream, context);
        },
    };
}

// Evaluate a value - resolve words, extract scalars
export function evalValue(val, context) {
    if (isa(val, Word)) {
        return context.get(val.spelling);
    }
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
