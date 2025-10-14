import { ReCell } from "./base.js";
import { NumberCell } from "./primitives.js";
import { WordCell } from "./words.js";

class SeriesBase extends ReCell {
    constructor(buffer, index = 0) {
        super();
        this.buffer = buffer;
        this.index = index;
    }
    isSeries = true;
    /**
     * Navigate by key (for paths)
     * @param {number|Symbol} key - Index or word
     */
    get(key) {
        if (typeof key === "number") {
            return this.buffer[key - 1];
        }

        // Symbol: SELECT - find key, return next
        if (typeof key === "symbol") {
            for (let i = 0; i < this.buffer.length - 1; i++) {
                const cell = this.buffer[i];
                if (cell instanceof WordCell && cell.spelling === key) {
                    return this.buffer[i + 1];
                }
            }
            return new NoneCell();
        }

        throw new Error(`Cannot index series with ${typeof key}`);
    }

    set(key, value) {
        if (typeof key === "number") {
            this.buffer[key - 1] = value;
            return this;
        }

        if (typeof key === "symbol") {
            for (let i = 0; i < this.buffer.length - 1; i++) {
                const cell = this.buffer[i];
                if (cell instanceof WordCell && cell.spelling === key) {
                    this.buffer[i + 1] = value;
                    return this;
                }
            }
            this.buffer.push(key, value);
            return this;
        }

        throw new Error(`Cannot set series with ${typeof key}`);
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
    evaluate(stream) {
        let result = null;
        for (const cell of this.buffer) {
            result = cell.evaluate(stream);
        }
        return result;
    }
}

/**
 * PATH! - series of values for navigation
 */
export class PathCell extends SeriesBase {
    evaluate(stream) {
        const [root, ...segments] = this.buffer;

        let current = root.evaluate(stream);
        console.log("ROOT: ", current);

        for (const segment of segments) {
            const key = this.getKey(segment);
            console.log("KEY: ", key);
            console.log("CURRENT: ", current);
            current = current.get(key);

            if (!current) {
                throw new Error(`Path navigation failed`, this, segment);
            }
        }

        return current;
    }

    getKey(cell) {
        if (cell.value) {
            return cell.value;
        }
        if (cell.spelling) {
            return cell.spelling;
        }
        throw new Error(`Invalid path key: ${cell.typeName}`);
    }
}

/// Get path, evaluates to the value from the literal value of the root
export class GetPathCell extends PathCell {}

/// Lit path, evaluates to itself
export class LitPathCell extends PathCell {}

/// Set path, evaluates by setting the value at the end of the path
export class SetPathCell extends PathCell {
    evaluate(stream) {
        const [root, ...segments] = this.buffer;

        let current = root.evaluate(stream);

        for (const segment of segments) {
            const key = this.getKey(segment);
            current = current.get(key);
            if (!current) {
                throw new Error(`Path navigation failed`, this, segment);
            }
        }
        const newValue = stream.evalNext();
        current.binding.set(current.spelling, newValue);
        return newValue;
    }
}

/**
 * BINARY! - byte data
 */
export class BinaryCell extends SeriesBase {
    // Self-evaluating
}
