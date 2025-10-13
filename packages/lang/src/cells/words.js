import { ReCell } from "./base.js";
import { normalize } from "../utils.js";
import { NoneCell } from "./primitives.js";
import { GLOBAL } from "../context.js";

class WordBase extends ReCell {
    constructor(spelling, binding = GLOBAL) {
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
        const value = this.binding.get(this.spelling);
        if (!value) {
            throw new Error(
                `${String(this.spelling)} has no value in: ${
                    JSON.stringify(this.binding, null, 2)
                }`,
            );
        }
        return value;
    }
}

/**
 * WORD! - evaluates to its bound value
 */
export class WordCell extends WordBase {
    evaluate(control, context) {
        if (!this.binding) {
            this.binding = context;
        }
        const value = this.lookup();
        if (!value) {
            return new NoneCell();
            throw new Error(
                `${String(this.spelling)} has no value in: ${
                    JSON.stringify(this.binding, null, 2)
                }`,
            );
        }
        if (value.isNativeCell) {
            return value.evaluate(control, this);
        }
        if (value.isNativeType) {
            return value;
        }
        return value.evaluate(control);
    }
}

/**
 * SET-WORD! - assigns the next value to this word
 * Example: x: 42
 */
export class SetWordCell extends WordBase {
    evaluate(control, context) {
        if (!this.binding) {
            this.binding = context;
        }
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
    evaluate(_control, context) {
        if (!this.binding) {
            this.binding = context;
        }
        return this.lookup();
    }
}

/**
 * LIT-WORD! - returns a regular word without evaluating
 * Example: 'x
 */
export class LitWordCell extends WordBase {
    evaluate(_control, context) {
        if (!this.binding) {
            this.binding = context;
        }
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
