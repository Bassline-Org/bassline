import { ReCell } from "./base.js";
import { Context } from "../context.js";
import { NumberCell } from "./primitives.js";

/**
 * Base class for all series types
 */
class SeriesBase extends ReCell {
    constructor(buffer, index = 0) {
        super();
        this.buffer = buffer;
        this.index = index;
    }
    isSeries = true;

    // Series are self-evaluating
    // evaluate() inherits from ReCell

    /**
     * Create a new series cell at a different position
     * Same buffer, different index
     */
    at(newIndex) {
        return new this.constructor(this.buffer, newIndex);
    }

    /**
     * Move to next position
     */
    next() {
        const newIndex = Math.min(this.index + 1, this.buffer.length);
        return this.at(newIndex);
    }

    /**
     * Move back one position
     */
    back() {
        const newIndex = Math.max(0, this.index - 1);
        return this.at(newIndex);
    }

    /**
     * Skip n positions (can be negative)
     */
    skip(n) {
        const newIndex = Math.max(
            0,
            Math.min(this.index + n, this.buffer.length),
        );
        return this.at(newIndex);
    }

    /**
     * Go to head
     */
    head() {
        return this.at(0);
    }

    /**
     * Go to tail (past the end)
     */
    tail() {
        return this.at(this.buffer.length);
    }

    /**
     * Check if at tail
     */
    isTail() {
        return this.index >= this.buffer.length;
    }

    /**
     * Get length from current position to tail
     */
    length() {
        return Math.max(0, this.buffer.length - this.index);
    }

    /**
     * Access current value
     */
    first() {
        if (this.index >= this.buffer.length) {
            throw new Error("Out of range or past end");
        }
        return this.buffer[this.index];
    }

    /**
     * Pick value at offset (1-based like REBOL)
     */
    pick(n) {
        const targetIndex = this.index + n - 1;
        if (targetIndex < 0 || targetIndex >= this.buffer.length) {
            return make.none();
        }
        return this.at(targetIndex);
    }
}

/**
 * BLOCK! - executable code and data
 * Self-evaluating, inherits from SeriesBase
 */
export class BlockCell extends SeriesBase {}

/**
 * STRING! - text data
 */
export class StringCell extends SeriesBase {}

/**
 * PAREN! - executable code and data
 * Eagerly evaluates it's contents
 */
export class ParenCell extends SeriesBase {
    evaluate(control) {
        let result = null;
        for (const cell of this.buffer) {
            result = cell.evaluate(control);
        }
        return result;
    }
}

/**
 * PATH! - series of values for navigation
 */
export class PathCell extends SeriesBase {
    evaluate(control) {
        const [root, ...segments] = this.buffer;
        const rootValue = root.evaluate(root);
        return segments.reduce((value, segment) => {
            const key = segment instanceof NumberCell
                ? segment.evaluate(control)
                : segment.spelling;
            return value.at(key);
        }, rootValue);
    }
}

/// Get path, evaluates to the value from the literal value of the root
export class GetPathCell extends SeriesBase {
    evaluate(control) {
        const [root, ...segments] = this.buffer;
        return segments.reduce((value, segment) => {
            return value.get(segment.evaluate(control));
        }, root);
    }
}

/// Lit path, evaluates to itself
export class LitPathCell extends SeriesBase {
    evaluate(control) {
        return this;
    }
}

/// Set path, evaluates by setting the value at the end of the path
export class SetPathCell extends SeriesBase {
    evaluate(control) {
        const [root, ...segments] = this.buffer;
        const rootValue = root.evaluate(root);
        return segments.reduce((value, segment, index) => {
            if (index === segments.length - 1) {
                return value.set(segment.evaluate(control), value);
            }
            return value.get(segment.evaluate(control));
        }, rootValue);
    }
}

/**
 * BINARY! - byte data
 */
export class BinaryCell extends SeriesBase {
    // Self-evaluating
}
