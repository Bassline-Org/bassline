import { isAnyWord, ReCell, series, SeriesBuffer, TYPE } from "./cells.js";
import { normalize } from "./spelling.js";

export function bind(wordCell, context) {
    if (isAnyWord(wordCell)) {
        // Check if this word exists in the target context
        // If not, return the word unchanged (ineffective bind)
        const existsInContext = context.get(wordCell.spelling) !== undefined;

        if (existsInContext) {
            // Effective bind: word exists in context, rebind it
            return new ReCell(wordCell.type, {
                spelling: normalize(wordCell.spelling),
                binding: context,
            });
        } else {
            // Ineffective bind: word doesn't exist, return unchanged
            return wordCell;
        }
    }
    if (series.isSeries(wordCell)) {
        for (let i = 0; i < wordCell.buffer.data.length; i++) {
            wordCell.buffer.data[i] = bind(wordCell.buffer.data[i], context);
        }
        return wordCell;
    }
    return wordCell;
}

export function lookup(wordCell) {
    if (!isAnyWord(wordCell)) {
        throw new Error(
            `${wordCell} is not asa word cell! You can only lookup the bound value of an anyWord! Got: ${wordCell.type}`,
        );
    }
    if (!wordCell.binding) {
        throw new Error(`${wordCell.spelling} has no context`);
    }
    return wordCell.binding.get(wordCell.spelling);
}
