import { TYPE } from "./cells.js";
import { lookup } from "./bind.js";

export function evaluate(cell) {
    switch (cell.type) {
        case TYPE.LIT_WORD:
            // Returns a WORD! cell
            return wordConvert.toWord(cell);

        case TYPE.GET_WORD:
            // RETURNS THE CELL VALUE, BUT DOESN"T CALL IT IF FN
            return lookup(cell);

        case TYPE.WORD:
            // RETURNS THE CELL VALUE, AND CALLS IF A FUNCTION
            return lookup(cell);
        case TYPE.SET_WORD:
            throw new Error("SET_WORD! cannot be evaluated alone - use do()");
            // THESE ALL JUST EVALUATE TO THEMSELVES
        case TYPE.NUMBER:
        case TYPE.STRING:
        case TYPE.BLOCK:
        case TYPE.NONE:
            return cell;
        default:
            console.warn(`Fallback default: ${cell.type}`);
            return cell;
    }
}

export function doBlock(cell) {
    if (!series.isSeries(cell) || cell.type !== TYPE.BLOCK) {
        return evaluate(cell);
    }

    let result = make.none();
    let pos = cell.index;

    while (pos < cell.buffer.length) {
        const current = cell.buffer.data[pos];

        if (current.type === TYPE.SET_WORD) {
            if (pos + 1 >= cell.buffer.length) {
                throw new Error("SET_WORD! at end of block");
            }
            pos++;
            const value = evaluate(cell.buffer.data[pos]);
            current.binding.set(current.spelling, value);
            result = value;
        } else {
            result = evaluate(current);
        }
        pos++;
    }

    return result;
}
