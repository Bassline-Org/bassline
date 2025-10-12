import { ReCell } from "./base.js";
import { Context } from "../context.js";
import { NoneCell } from "./primitives.js";
import { bind } from "../bind.js";
import { deepCopy } from "../copy.js";
import { isAnyWord, SetWordCell } from "./words.js";
import { isSeries, series } from "./series.js";

/**
 * Mutable function object that holds the function's state
 */
export class RFunction {
    constructor(spec, body, context) {
        this.spec = spec; // Array of parameter Symbols
        this.body = body; // Bound body block cell
        this.context = context; // Function's local context
        this.recursionLevel = 0; // For Dynamic Recursion Patch
    }

    /**
     * Execute this function with the given arguments
     * @param {Array<ReCell>} args - Evaluated arguments
     * @param {Evaluator} evaluator - The evaluator
     * @returns {ReCell}
     */
    execute(args, evaluator) {
        // Dynamic Recursion Patch: detect recursive call
        this.recursionLevel++;

        const callStack = RFunction.callStack;
        if (this.recursionLevel > 1) {
            // Save old parameter values for outer call
            const oldValues = this.spec.map((paramName) =>
                this.context.get(paramName)
            );
            callStack.push(oldValues);
        }

        // Set parameters from arguments
        for (let i = 0; i < this.spec.length; i++) {
            const value = i < args.length ? args[i] : new NoneCell();
            this.context.set(this.spec[i], value);
        }

        // Execute the body
        const result = evaluator.doBlock(this.body);

        // Restore for recursion
        this.recursionLevel--;
        if (this.recursionLevel > 0) {
            const oldValues = callStack.pop();
            for (let i = 0; i < this.spec.length; i++) {
                this.context.set(this.spec[i], oldValues[i]);
            }
        }

        return result;
    }
}

// Global call stack for Dynamic Recursion Patch
RFunction.callStack = [];

/**
 * FUNCTION! cell - represents a callable function
 */
export class FunctionCell extends ReCell {
    constructor(rfunc) {
        super();
        this.fn = rfunc;
    }

    // Functions self-evaluate
    // evaluate() inherits from ReCell

    isApplicable() {
        return true;
    }

    step(codeStream, evaluator) {
        const args = [];
        let pos = series.next(codeStream); // Skip past myself
        let totalConsumed = 1; // Count ourselves

        // Consume N arguments
        for (let i = 0; i < this.fn.spec.length; i++) {
            if (series.isTail(pos)) {
                throw new Error(
                    `Not enough arguments for function (expected ${this.fn.spec.length}, got ${i})`,
                );
            }

            // Step each argument
            const result = series.first(pos).step(pos, evaluator);
            args.push(result.value);
            totalConsumed += result.consumed; // Track actual consumption
            pos = pos.skip(result.consumed);
        }

        // Execute the function
        const value = this.fn.execute(args, evaluator);

        return {
            value,
            consumed: totalConsumed, // Return actual total
        };
    }
}

/**
 * Scan a block for SET-WORDs (these become local variables)
 */
function scanForSetWords(cell, setWords) {
    if (cell instanceof SetWordCell) {
        setWords.add(cell.spelling);
    } else if (isSeries(cell)) {
        // Recursively scan subblocks
        let pos = cell.head();
        while (!pos.isTail()) {
            scanForSetWords(pos.first(), setWords);
            pos = pos.next();
        }
    }
}

/**
 * Extract parameter names from a spec block
 */
function extractParams(specBlock) {
    const params = [];

    if (!specBlock || !isSeries(specBlock)) {
        return params;
    }

    let pos = specBlock.head();
    while (!pos.isTail()) {
        const cell = pos.first();
        if (isAnyWord(cell)) {
            params.push(cell.spelling);
        }
        pos = pos.next();
    }

    return params;
}

/**
 * Create a function from a spec and body
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
        fnContext.set(paramSpelling, new NoneCell());
    }

    // Add local variables (SET-WORDs found in body)
    for (const localSpelling of locals) {
        // Only add if not already a parameter
        if (!params.includes(localSpelling)) {
            fnContext.set(localSpelling, new NoneCell());
        }
    }

    // 4. Deep copy body (so each function has independent code)
    const bodyCopy = deepCopy(bodyBlock);

    // 5. Bind body to the function's context
    bind(bodyCopy, fnContext);

    // 6. Create the function object and cell
    const rfunc = new RFunction(params, bodyCopy, fnContext);
    return new FunctionCell(rfunc).freeze();
}
