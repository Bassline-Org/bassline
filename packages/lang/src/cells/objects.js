// src/cells/objects.js
import { Context } from "../context.js";
import { bind } from "../bind.js";
import { deepCopy } from "../copy.js";
import { isSeries } from "./series.js";
import { SetWordCell } from "./words.js";
import { make } from "./factories.js";

/**
 * Create an object from a spec block
 * Returns a Context that serves as the object
 */
export function makeObject(spec, evaluator) {
    if (!isSeries(spec)) {
        throw new Error("make object!: spec must be a block");
    }

    // 1. Create new context (this IS the object)
    const objContext = new Context();

    // 2. Add self reference
    objContext.set("self", objContext);

    // 3. Deep copy the spec so it doesn't mutate original
    const specCopy = deepCopy(spec);

    // 4. Pre-scan for SET-WORDs to create bindings
    prescanForSetWords(specCopy, objContext);

    // 5. Bind spec to object context
    bind(specCopy, objContext);

    // 6. Execute spec to initialize fields
    evaluator.doBlock(specCopy);

    // 7. Return the context (which is the object)
    return objContext;
}

/**
 * Scan for SET-WORDs and create bindings
 */
function prescanForSetWords(cell, context) {
    if (cell instanceof SetWordCell) {
        if (context.get(cell.spelling) === undefined) {
            context.set(cell.spelling, make.none());
        }
    } else if (isSeries(cell)) {
        for (let i = 0; i < cell.buffer.data.length; i++) {
            prescanForSetWords(cell.buffer.data[i], context);
        }
    }
}
