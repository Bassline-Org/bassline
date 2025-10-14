import { BlockCell, isAnyWord } from "./cells/index.js";
import { GLOBAL } from "./context.js";

/**
 * Bind a word (or block of words) to the context of a known word.
 *
 * For words: Attempts to return a word with the same spelling as the original
 * If we can't, it returns the original word, and doesn't bind it (Inneffective bind)
 * If we can, it returns a new word with the same spelling, bound to the context of the known word.
 * For series: mutates buffer by attempting to bind each word to the context of the known word.
 * For other cells: returns the original cell
 */
export function bind(words, knownWord) {
    //console.log("KNOWN WORD: ", knownWord);
    //console.log("KNOW WORD BINDING: ", knownWord.binding);
    if (!knownWord) throw new Error("Known word is required");
    if (!knownWord.binding) throw new Error("Known word must have a binding!");

    const context = knownWord.binding;
    if (isAnyWord(words)) {
        //console.log("AnyWord: ", words);
        // Check if this word exists in the target context
        // If not, return unchanged (ineffective bind)
        const existsInContext = context.get(words.spelling) !== undefined;
        console.log(
            `EXISTS IN CONTEXT: ${String(words.spelling)}`,
            existsInContext,
        );
        if (existsInContext) {
            // Effective bind: word exists in context, create new word with new binding
            const CellClass = words.constructor;
            const boundCell = new CellClass(words.spelling, context).freeze();
            return boundCell;
        } else {
            // Ineffective bind: word doesn't exist, return unchanged
            return words;
        }
    }

    if (words.isSeries) {
        // Rebind all words in the series buffer
        console.log("KNOWN WORD: ", knownWord.binding);
        for (let i = 0; i < words.buffer.length; i++) {
            words.buffer[i] = bind(words.buffer[i], knownWord);
            console.log("BOUND IN SERIES: ", words.buffer[i]);
            console.log("--------------------------------");
            console.log("BINDING: ", words.buffer[i].binding);
            console.log("--------------------------------");
        }
        return words;
    }

    return words;
}

export function loadBinding(tree, context = GLOBAL) {
    for (const cell of tree) {
        if (isAnyWord(cell)) {
            cell.binding = context;
        }
        if (cell.isSeries) loadBinding(cell.buffer, context);
    }
}
