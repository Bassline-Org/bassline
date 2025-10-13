import { ReCell } from "./base.js";
import { Context } from "../context.js";
import { NumberCell } from "./primitives.js";
import { bind } from "../bind.js";

class SeriesBase extends ReCell {
    constructor(buffer, index = 0) {
        super();
        this.buffer = buffer;
        this.index = index;
    }
    isSeries = true;
    get(index) {
        if (this.buffer[index]) {
            return new this.constructor(this.buffer, index);
        }
        return make.none();
    }
    set(index, value) {
        if (this.buffer[index]) {
            this.buffer[index] = value;
        }
        return this;
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
    getKeyOf(value) {
        return value.spelling ?? value.value;
    }
    evaluate(control, context) {
        const [root, ...segments] = this.buffer;
        const rootValue = root.evaluate(control, context);
        return segments.reduce((value, segment) => {
            const segmentValue = segment.evaluate(control, value);
            return value.get(this.getKeyOf(segmentValue));
        }, rootValue);
    }
}

/// Get path, evaluates to the value from the literal value of the root
export class GetPathCell extends PathCell {}

/// Lit path, evaluates to itself
export class LitPathCell extends PathCell {}

/// Set path, evaluates by setting the value at the end of the path
export class SetPathCell extends PathCell {
    evaluate(control, context) {
        const [root, ...segments] = this.buffer;
        const rootValue = root.evaluate(control, context);
        const newValue = control.evalNext();
        return segments.reduce((value, segment, index) => {
            const key = this.getKeyOf(segment.evaluate(control, value));
            if (index === segments.length - 1) {
                return value.set(key, newValue);
            } else {
                return value.get(key);
            }
        }, rootValue);
    }
}

/**
 * BINARY! - byte data
 */
export class BinaryCell extends SeriesBase {
    // Self-evaluating
}
