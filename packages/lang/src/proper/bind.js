import { isAnyWord, ReCell, series, TYPE } from "./cells.js";
import { normalize } from "./spelling.js";

export function bind(wordCell, context) {
    if (isAnyWord(wordCell)) {
        return new ReCell(wordCell.type, {
            spelling: normalize(wordCell.spelling),
            binding: context,
        });
    }
    if (series.isSeries(wordCell)) {
        const newData = wordCell.buffer.data.map((elem) => bind(elem, context));
        const newBuffer = new SeriesBuffer(newData);

        return new ReCell(wordCell.type, {
            buffer: newBuffer,
            index: cell.index,
        });
    }
    return wordCell;
}

export function lookup(wordCell) {
    const spelling = normalize(wordCell.spelling);
    if (isAnyWord(wordCell)) {
        throw new Error(
            `${wordCell} is not a word cell! You can only lookup the bound value of an anyWord! Got: ${wordCell.type}`,
        );
    }
    if (!wordCell.binding) {
        throw new Error(`${spelling} has no context`);
    }
    return wordCell.binding.get(spelling);
}
