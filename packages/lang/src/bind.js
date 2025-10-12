import { isAnyWord, isSeries } from "./cells/index.js";

/**
 * Bind a word (or block of words) to a context.
 * Creates new cells with new bindings.
 *
 * For words: returns new word with context binding
 * For series: mutates buffer by replacing words with rebound versions
 * For other cells: returns unchanged
 */
export function bind(cell, context) {
    if (isAnyWord(cell)) {
        // Check if this word exists in the target context
        // If not, return unchanged (ineffective bind)
        const existsInContext = context.get(cell.spelling) !== undefined;

        if (existsInContext) {
            // Effective bind: word exists in context, create new word with new binding
            const CellClass = cell.constructor;
            return new CellClass(cell.spelling, context).freeze();
        } else {
            // Ineffective bind: word doesn't exist, return unchanged
            return cell;
        }
    }

    if (isSeries(cell)) {
        // Rebind all words in the series buffer
        for (let i = 0; i < cell.buffer.data.length; i++) {
            cell.buffer.data[i] = bind(cell.buffer.data[i], context);
        }
        return cell;
    }

    return cell;
}

/**
 * Look up a word's value in its binding
 */
export function lookup(wordCell) {
    if (!isAnyWord(wordCell)) {
        throw new Error(
            `Cannot lookup non-word cell! Got: ${wordCell.typeName}`,
        );
    }
    if (!wordCell.binding) {
        throw new Error(`${String(wordCell.spelling)} has no context`);
    }
    return wordCell.binding.get(wordCell.spelling);
}
