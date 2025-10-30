import { parse as parseData } from "@bassline/parser";
import { TYPES } from "@bassline/parser/data";
import * as core from "./semantics/default/index.js";

export function parse(source) {
    const data = parseData(source);
    return toCell(data);
}

function toCell({ type, value }) {
    switch (type) {
        case TYPES.number:
            return core.number(value);
        case TYPES.string:
            return core.string(value);
        case TYPES.word:
            return core.word(value);
        case TYPES.getWord:
            return core.getWord(value);
        case TYPES.setWord:
            return core.setWord(value);
        case TYPES.litWord:
            return core.litWord(value);
        case TYPES.block:
            return core.block(value.map(toCell));
        case TYPES.paren:
            return core.paren(value.map(toCell));
        case TYPES.uri:
            return core.uri(value);
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}
