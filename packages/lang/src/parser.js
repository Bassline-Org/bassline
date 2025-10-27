import { parse as parseData } from "@bassline/parser";
import { TYPES } from "@bassline/parser/data";
import * as core from "./prelude/index.js";

export function parse(source) {
    const data = parseData(source);
    return toCell(data);
}

function toCell({ type, value }) {
    switch (type) {
        case TYPES.number:
            return new core.Num(value);
        case TYPES.string:
            return new core.Str(value);
        case TYPES.word:
            return new core.Word(value);
        case TYPES.getWord:
            return new core.GetWord(value);
        case TYPES.setWord:
            return new core.SetWord(value);
        case TYPES.litWord:
            return new core.LitWord(value);
        case TYPES.block:
            return new core.Block(value.map(toCell));
        case TYPES.paren:
            return new core.Paren(value.map(toCell));
        case TYPES.uri:
            return new core.Uri(value);
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}
