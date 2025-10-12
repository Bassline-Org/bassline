import { ReCell } from "./base.js";

/**
 * Shared buffer for series - mutable data structure
 */
export class SeriesBuffer {
    constructor(data = []) {
        this.data = data;
    }

    get length() {
        return this.data.length;
    }
}

/**
 * Base class for all series types
 */
class SeriesBase extends ReCell {
    constructor(buffer, index = 0) {
        super();
        this.buffer = buffer instanceof SeriesBuffer
            ? buffer
            : new SeriesBuffer(buffer);
        this.index = index;
    }

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
        return this.buffer.data[this.index];
    }

    /**
     * Pick value at offset (1-based like REBOL)
     */
    pick(n) {
        const targetIndex = this.index + n - 1;
        if (targetIndex < 0 || targetIndex >= this.buffer.length) {
            return null; // REBOL returns none, we'll handle this
        }
        return this.buffer.data[targetIndex];
    }
}

/**
 * BLOCK! - executable code and data
 */
export class BlockCell extends SeriesBase {
    // Self-evaluating, inherits from SeriesBase
}

/**
 * STRING! - text data
 */
export class StringCell extends SeriesBase {
    constructor(strOrBuffer, index = 0) {
        if (typeof strOrBuffer === "string") {
            super(new SeriesBuffer(Array.from(strOrBuffer)), index);
        } else {
            super(strOrBuffer, index);
        }
    }
}

/**
 * PAREN! - immediately evaluated code
 */
export class ParenCell extends SeriesBase {
    evaluate(evaluator) {
        // Parens evaluate their contents
        return evaluator.doBlock(this);
    }
}

/**
 * PATH! - series of values for navigation
 */
export class PathCell extends SeriesBase {
    // TODO: Path evaluation
}

/**
 * BINARY! - byte data
 */
export class BinaryCell extends SeriesBase {
    // Self-evaluating
}

/**
 * Check if a cell is a series type
 */
export function isSeries(cell) {
    return cell instanceof SeriesBase;
}

/**
 * Series utilities - operates on any series cell
 */
export const series = {
    isSeries,

    next: (cell) => cell.next(),
    back: (cell) => cell.back(),
    skip: (cell, n) => cell.skip(n),
    head: (cell) => cell.head(),
    tail: (cell) => cell.tail(),
    isTail: (cell) => cell.isTail(),
    length: (cell) => cell.length(),
    first: (cell) => cell.first(),
    pick: (cell, n) => cell.pick(n),
};
