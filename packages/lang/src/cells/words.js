import { ReCell } from "./base.js";
import { normalize } from "../utils.js";

class WordBase extends ReCell {
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }

    /**
     * Look up this word's value in its binding context
     * @returns {ReCell}
     */
    lookup() {
        //console.log("lookup", this.spelling, this.binding);
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
    evaluate(stream) {
        //console.log("Word evaluate", this.spelling, this.binding, stream);
        const value = this.lookup();
        if (!value) {
            throw new Error(
                `${String(this.spelling)} has no value in: ${
                    JSON.stringify(this.binding, null, 2)
                }`,
            );
        }
        if (value.isNativeCell) {
            return value.evaluate(stream);
        }
        if (value.isNativeType) {
            return value;
        }
        return value.evaluate(stream);
    }
}

/**
 * SET-WORD! - assigns the next value to this word
 * Example: x: 42
 */
export class SetWordCell extends WordBase {
    evaluate(stream) {
        const next = stream.evalNext();
        if (!next) {
            throw new Error("Invalid SET_WORD: expected a value!");
        }
        if (!this.binding) {
            throw new Error(`${String(this.spelling)} has no context`);
        }
        this.binding.set(this.spelling, next);
        console.log("BINDING: ", this.binding);
        return next;
    }
}

/**
 * GET-WORD! - returns bound value without evaluating it further
 * Example: :x
 */
export class GetWordCell extends WordBase {
    evaluate(_stream) {
        if (!this.binding) {
            throw new Error(`${String(this.spelling)} has no context`);
        }
        return this.lookup();
    }
}

/**
 * LIT-WORD! - returns a regular word without evaluating
 * Example: 'x
 */
export class LitWordCell extends WordBase {
    evaluate(_stream) {
        if (!this.binding) {
            throw new Error(`${String(this.spelling)} has no context`);
        }
        const cell = new WordCell(this.spelling);
        return bind(cell, this);
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
