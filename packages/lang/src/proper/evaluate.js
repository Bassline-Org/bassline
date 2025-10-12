import { TYPE } from "./cells.js";
import { lookup } from "./bind.js";

export function evaluate(cell) {
    switch (cell.type) {
        case TYPE.WORD:
        case TYPE.GET_WORD:
        case TYPE.SET_WORD:
            if (!cell.binding) {
                throw new Error(`${cell.spelling} has no context`);
            }
            return lookup(cell);
        case TYPE.LIT_WORD:
        case TYPE.NUMBER:
        case TYPE.STRING:
        case TYPE.BLOCK:
        case TYPE.NONE:
            return cell;
    }
}
