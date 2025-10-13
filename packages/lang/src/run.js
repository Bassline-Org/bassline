import { parse } from "./parser.js";
import { bind, bindAll } from "./bind.js";
import { GLOBAL } from "./context.js";
import { isAnyWord, isSeries, make } from "./cells/index.js";

/**
 * Scan a cell for SET-WORDs and pre-create bindings
 */
export function prescan(cell, context) {
    if (isAnyWord(cell)) {
        // Create binding for this SET-WORD if it doesn't exist
        if (context.get(cell.spelling) === undefined) {
            context.set(cell.spelling, make.none());
        }
    } else if (isSeries(cell)) {
        // Recursively scan blocks
        for (let i = 0; i < cell.buffer.data.length; i++) {
            prescan(cell.buffer.data[i], context);
        }
    }
}

export function run(source, context = GLOBAL) {
    const block = parse(source); // Unbound cells
    prescan(block, context); // Create bindings for SET-WORDs
    bind(block, context); // Now bind will be effective
    return doBlock(block); // Execute
}
