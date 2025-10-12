// object.js
import { Context } from "./context.js";
import { make, TYPE } from "./cells.js";
import { bind } from "./bind.js";
import { normalize } from "./spelling.js";
import { doBlock } from "./evaluate.js";

export function makeObject(spec) {
    // 1. Find all set-words in spec
    const setWords = new Set(["self"]); // Always include 'self'

    function scanForSetWords(cell) {
        if (cell.type === TYPE.SET_WORD) {
            setWords.add(String(cell.spelling.description || cell.spelling));
        } else if (cell.type === TYPE.BLOCK) {
            // Recursively scan subblocks
            for (const elem of cell.buffer.data) {
                scanForSetWords(elem);
            }
        }
    }

    for (const cell of spec.buffer.data) {
        scanForSetWords(cell);
    }

    // 2. Create context with all those words
    const objContext = new Context();
    for (const word of setWords) {
        objContext.set(normalize(word), make.none());
    }

    // 3. Set 'self to refer to the context
    objContext.set(normalize("self"), objContext);

    // 4. Bind spec to the context
    bind(spec, objContext);

    // 5. Evaluate the spec
    doBlock(spec);

    // 6. Return the context (the object)
    return objContext;
}
