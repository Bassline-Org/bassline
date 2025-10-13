import { ReCell } from "./base.js";
import { normalize } from "../spelling.js";

class WordBase extends ReCell {
    constructor(spelling, binding) {
        super();
        this.spelling = normalize(spelling);
        this.binding = binding;
    }

    /**
     * Look up this word's value in its binding context
     * @returns {ReCell}
     */
    lookup() {
        if (!this.binding) {
            throw new Error(`${String(this.spelling)} has no context`);
        }
        return this.binding.get(this.spelling);
    }
}
/**
 * WORD! - evaluates to its bound value
 */
export class WordCell extends WordBase {
    evaluate(_evaluator) {
        return this.lookup();
    }

    step(codeStream, evaluator) {
        const value = this.lookup();

        // If the value is applicable (like a function), delegate to it
        if (value.isApplicable && value.isApplicable()) {
            return value.step(codeStream, evaluator);
        }

        // Otherwise, just return the value
        return { value, consumed: 1 };
    }
}

/**
 * SET-WORD! - assigns the next value to this word
 * Example: x: 42
 */
export class SetWordCell extends WordBase {
    evaluate(_evaluator) {
        throw new Error("SET_WORD cannot be evaluated alone - use in context");
    }

    step(codeStream, evaluator) {
        // Consume myself and the next value
        const series = evaluator.series;
        const next = series.next(codeStream);

        if (series.isTail(next)) {
            throw new Error("SET_WORD at end of block");
        }

        // Step the next cell to get its value
        const result = series.first(next).step(next, evaluator);

        // Assign to this word
        this.binding.set(this.spelling, result.value);

        return {
            value: result.value,
            consumed: 1 + result.consumed, // Me + what the value consumed
        };
    }
}

/**
 * GET-WORD! - returns bound value without evaluating it further
 * Example: :x
 */
export class GetWordCell extends WordBase {
    evaluate(_evaluator) {
        return this.lookup();
    }
}

/**
 * LIT-WORD! - returns a regular word without evaluating
 * Example: 'x
 */
export class LitWordCell extends WordBase {
    evaluate(_evaluator) {
        return new WordCell(this.spelling, this.binding);
    }
}

/**
 * REFINEMENT! - path refinements
 * Example: /local
 */
export class RefinementCell extends WordBase {
    constructor(spelling) {
        super(spelling, undefined); // Refinements don't have bindings
    }
}

/**
 * Check if a cell is any word type
 */
export function isAnyWord(cell) {
    return (
        cell instanceof WordCell ||
        cell instanceof SetWordCell ||
        cell instanceof GetWordCell ||
        cell instanceof LitWordCell
    );
}
