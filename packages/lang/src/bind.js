import { isAnyWord } from "./cells/index.js";

/**
 * Bind a word (or block of words) to the context of a known word.
 *
 * For words: Attempts to return a word with the same spelling as the original
 * If we can't, it returns the original word, and doesn't bind it (Inneffective bind)
 * If we can, it returns a new word with the same spelling, bound to the context of the known word.
 * For series: mutates buffer by attempting to bind each word to the context of the known word.
 * For other cells: returns the original cell
 */
export function bind(cell, knownWord) {
    if (!knownWord) throw new Error("Known word is required");
    if (!knownWord.binding) throw new Error("Known word must have a binding!");

    const context = knownWord.binding;
    if (isAnyWord(cell)) {
        // Check if this word exists in the target context
        // If not, return unchanged (ineffective bind)
        const existsInContext = context.get(cell.spelling) !== undefined;

        if (existsInContext) {
            // Effective bind: word exists in context, create new word with new binding
            const CellClass = cell.constructor;
            const boundCell = new CellClass(cell.spelling, context).freeze();
            return boundCell;
        } else {
            // Ineffective bind: word doesn't exist, return unchanged
            return cell;
        }
    }

    if (cell.isSeries) {
        // Rebind all words in the series buffer
        for (let i = 0; i < cell.buffer.length; i++) {
            cell.buffer[i] = bind(cell.buffer[i], knownWord);
        }
        return cell;
    }

    return cell;
}
