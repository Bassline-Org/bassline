import { isAnyWord, make, series, TYPE } from "./cells.js";
import { Context } from "./context.js";
import { bind } from "./bind.js";
import { deepCopy } from "./copy.js";
import { doBlock } from "./evaluate.js";

/**
 * Mutable function object that holds the function's state.
 * This is what the immutable function cell points to.
 */
export class RFunction {
    constructor(spec, body, context) {
        this.spec = spec; // Array of parameter Symbols
        this.body = body; // Bound body block cell
        this.context = context; // Function's local context
        this.recursionLevel = 0; // For Dynamic Recursion Patch
    }
}

/**
 * Extract parameter names from a spec block.
 * In a full REBOL implementation, this would handle refinements,
 * /local declarations, type annotations, etc.
 * For now, we just extract any-word! values.
 */
function extractParams(specBlock) {
    const params = [];

    if (!specBlock || !specBlock.buffer) {
        return params;
    }

    for (const cell of specBlock.buffer.data) {
        if (isAnyWord(cell)) {
            params.push(cell.spelling);
        }
        // TODO: Handle /local and refinements
    }

    return params;
}
/**
 * Scan a block (and its subblocks) for all SET-WORDs.
 * These become local variables in the function.
 */
function scanForSetWords(cell, setWords) {
    if (cell.type === TYPE.SET_WORD) {
        setWords.add(cell.spelling);
    } else if (series.isSeries(cell) && cell.type === TYPE.BLOCK) {
        // Recursively scan subblocks
        for (const elem of cell.buffer.data) {
            scanForSetWords(elem, setWords);
        }
    }
}
/**
 * Create a function from a spec and body.
 * This follows the FUNC model from Bindology:
 * 1. Extract parameter names from spec
 * 2. Create a new context with those parameters
 * 3. Deep copy the body
 * 4. Bind the body to the new context
 * 5. Return a function cell
 */
export function makeFunc(specBlock, bodyBlock) {
    // 1. Extract parameter names
    const params = extractParams(specBlock);

    // 2. Find all SET-WORDs in body (these become locals)
    const locals = new Set();
    scanForSetWords(bodyBlock, locals);

    // 3. Create context with parameters + locals
    const fnContext = new Context();

    // Add parameters first
    for (const paramSpelling of params) {
        fnContext.set(paramSpelling, make.none());
    }

    // Add local variables (SET-WORDs found in body)
    for (const localSpelling of locals) {
        // Only add if not already a parameter
        if (!params.includes(localSpelling)) {
            fnContext.set(localSpelling, make.none());
        }
    }

    // 4. Deep copy body (so each function has independent code)
    const bodyCopy = deepCopy(bodyBlock);

    // 5. Bind body to the function's context
    // This MUTATES the word cells in bodyCopy's buffer
    bind(bodyCopy, fnContext);

    // 6. Create the mutable function object
    const rfunc = new RFunction(params, bodyCopy, fnContext);

    // 7. Wrap it in an immutable cell
    return make.fn(rfunc);
}

/**
 * Global call stack for Dynamic Recursion Patch.
 * When a function calls itself recursively, we save/restore
 * parameter values here.
 */
const callStack = [];

/**
 * Call a function with arguments.
 * Implements the Dynamic Recursion Patch from Bindology:
 * - Reuses the same context across all calls
 * - Saves/restores values for recursive calls
 */
export function callFunction(fnCell, argValues) {
    if (fnCell.type !== TYPE.FUNCTION) {
        throw new Error("Not a function!");
    }

    const fn = fnCell.fn;

    // Dynamic Recursion Patch: detect recursive call
    fn.recursionLevel++;

    if (fn.recursionLevel > 1) {
        // Save old parameter values for outer call
        const oldValues = fn.spec.map((paramName) => fn.context.get(paramName));
        callStack.push(oldValues);
    }

    // Set parameters from arguments
    for (let i = 0; i < fn.spec.length; i++) {
        const value = i < argValues.length ? argValues[i] : make.none();
        fn.context.set(fn.spec[i], value);
    }

    // Execute the body
    const result = doBlock(fn.body);

    // Restore for recursion
    fn.recursionLevel--;
    if (fn.recursionLevel > 0) {
        const oldValues = callStack.pop();
        for (let i = 0; i < fn.spec.length; i++) {
            fn.context.set(fn.spec[i], oldValues[i]);
        }
    }

    return result;
}
