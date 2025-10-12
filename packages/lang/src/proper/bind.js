import { ReCell } from "./cells.js";
import { normalize } from "./spelling.js";

export function bind(wordCell, context) {
    return new ReCell(wordCell.type, {
        spelling: normalize(wordCell.spelling),
        binding: context,
    });
}

export function lookup(wordCell) {
    console.log("Word cell: ", wordCell);
    const spelling = normalize(wordCell.spelling);
    if (!wordCell.binding) {
        throw new Error(`${spelling} has no context`);
    }
    return wordCell.binding.get(spelling);
}
