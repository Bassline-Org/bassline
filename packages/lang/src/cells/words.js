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
    evaluate(control) {
        const value = this.lookup();
        if (!value) {
            throw new Error(
                `${String(this.spelling)} has no value in: ${
                    JSON.stringify(this.binding, null, 2)
                }`,
            );
        }
        if (value.isNativeCell) {
            return value.evaluate(control, this);
        }
        return value.evaluate(control);
    }
}

/**
 * SET-WORD! - assigns the next value to this word
 * Example: x: 42
 */
export class SetWordCell extends WordBase {
    evaluate(control) {
        const next = control.next();
        if (!next) {
            throw new Error("Invalid SET_WORD: expected a value!");
        }
        if (!this.binding) {
            throw new Error(`${String(this.spelling)} has no context`);
        }
        if (next.isNativeCell) {
            throw new Error("Cannot assign to native cell! " + next.spelling);
        }
        const value = next.evaluate(control);
        this.binding.set(this.spelling, value);
        return value;
    }
}

/**
 * GET-WORD! - returns bound value without evaluating it further
 * Example: :x
 */
export class GetWordCell extends WordBase {
    evaluate(_control) {
        return this.lookup();
    }
}

/**
 * LIT-WORD! - returns a regular word without evaluating
 * Example: 'x
 */
export class LitWordCell extends WordBase {
    evaluate(_control) {
        return new WordCell(this.spelling, this.binding);
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
