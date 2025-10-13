import { ReCell } from "./base.js";
import { Context } from "../context.js";
import { NumberCell } from "./primitives.js";

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
            return make.none();
        }
        return this.at(targetIndex);
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

export class ParenCell extends SeriesBase {
    evaluate(control) {
        let result = null;
        for (const cell of this.buffer.data) {
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
        throw new Error("I haven't implemented this yet! Bad goose!");
        if (this.isTail()) {
            throw new Error("Cannot evaluate empty path");
        }

        // Start with first element
        let value = evaluator.evaluate(this.first());
        let pos = this.next();

        // Navigate through path segments
        while (!pos.isTail()) {
            const selector = pos.first();

            // If value is a Context (object), select from it
            if (value instanceof Context) {
                if (selector.typeName === "word") {
                    value = value.get(selector.spelling);
                    if (value === undefined) {
                        throw new Error(
                            `Path: field ${
                                String(selector.spelling)
                            } not found in object`,
                        );
                    }
                } else {
                    throw new Error(
                        `Path: cannot select from object with ${selector.typeName}`,
                    );
                }
            } else if (isSeries(value)) {
                // Numeric index into series
                if (selector instanceof NumberCell) {
                    // REBOL uses 1-based indexing
                    const index = Math.floor(selector.value) - 1;
                    if (index < 0 || index >= value.buffer.length) {
                        throw new Error(
                            `Path: index ${selector.value} out of range`,
                        );
                    }
                    value = value.buffer.data[index];
                } else {
                    throw new Error(
                        `Path: cannot index series with ${selector.typeName}`,
                    );
                }
            } else {
                throw new Error(`Path: cannot select from ${value.typeName}`);
            }
            pos = pos.next();
        }

        return value;
    }
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
