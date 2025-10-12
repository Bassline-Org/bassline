import { normalize } from "./spelling.js";
import { makeObject } from "./object.js";
/**
 * An "enum" that lists off every type of cell in the system
 */
export const TYPE = {
    NONE: 0,
    NUMBER: 1,
    WORD: 2,
    SET_WORD: 3,
    GET_WORD: 4,
    LIT_WORD: 5,
    REFINEMENT: 6,
    BLOCK: 7,
    STRING: 8,
    BINARY: 9,
    PAREN: 10,
    PATH: 11,
    OBJECT: 12,
    FUNCTION: 13,
};

export class ReCell {
    constructor(type, props) {
        this.type = type;
        Object.assign(this, props);
        Object.freeze(this);
    }
}

/**
 * Series buffer - shared between cells pointing to same series at different positions
 */
export class SeriesBuffer {
    constructor(data = []) {
        this.data = data;
    }

    get length() {
        return this.data.length;
    }
}

export const make = {
    none() {
        return new ReCell(TYPE.NONE, {});
    },
    num(number = 0) {
        return new ReCell(TYPE.NUMBER, { value: number });
    },
    word(spelling, binding) {
        return new ReCell(TYPE.WORD, {
            spelling: normalize(spelling),
            binding,
        });
    },
    setWord(spelling, binding) {
        return new ReCell(TYPE.SET_WORD, {
            spelling: normalize(spelling),
            binding,
        });
    },

    getWord(spelling, binding) {
        return new ReCell(TYPE.GET_WORD, {
            spelling: normalize(spelling),
            binding,
        });
    },

    litWord(spelling, binding) {
        return new ReCell(TYPE.LIT_WORD, {
            spelling: normalize(spelling),
            binding,
        });
    },

    refinement(spelling) {
        return new ReCell(TYPE.REFINEMENT, {
            spelling: normalize(spelling),
        });
    },

    // Series constructors
    block(values = []) {
        const buffer = new SeriesBuffer(values);
        return new ReCell(TYPE.BLOCK, {
            buffer,
            index: 0,
        });
    },
    string(str = "") {
        // Store as array of codepoints for mutability, or just string if immutable
        const buffer = new SeriesBuffer(Array.from(str));
        return new ReCell(TYPE.STRING, {
            buffer,
            index: 0,
        });
    },
    binary(bytes = []) {
        const buffer = new SeriesBuffer(bytes);
        return new ReCell(TYPE.BINARY, {
            buffer,
            index: 0,
        });
    },
    paren(values = []) {
        const buffer = new SeriesBuffer(values);
        return new ReCell(TYPE.PAREN, {
            buffer,
            index: 0,
        });
    },
    path(values = []) {
        const buffer = new SeriesBuffer(values);
        return new ReCell(TYPE.PATH, {
            buffer,
            index: 0,
        });
    },
    object(spec) {
        return makeObject(spec);
    },
    fn(rfunc) {
        return new ReCell(TYPE.FUNCTION, { fn: rfunc });
    },
};

// Helper to check if cell is a word-like type
export function isWordType(cell) {
    return cell.type === TYPE.WORD ||
        cell.type === TYPE.SET_WORD ||
        cell.type === TYPE.GET_WORD ||
        cell.type === TYPE.LIT_WORD ||
        cell.type === TYPE.REFINEMENT;
}

// Helper to check if cell is any-word (not refinement)
export function isAnyWord(cell) {
    return cell.type === TYPE.WORD ||
        cell.type === TYPE.SET_WORD ||
        cell.type === TYPE.GET_WORD ||
        cell.type === TYPE.LIT_WORD;
}

// Convert between word types (useful for parsing/manipulation)
export const wordConvert = {
    toWord(wordCell) {
        if (!isAnyWord(wordCell)) {
            throw new Error("Not a word type");
        }
        return make.word(wordCell.spelling, wordCell.binding);
    },

    toSetWord(wordCell) {
        if (!isAnyWord(wordCell)) {
            throw new Error("Not a word type");
        }
        return make.setWord(wordCell.spelling, wordCell.binding);
    },

    toGetWord(wordCell) {
        if (!isAnyWord(wordCell)) {
            throw new Error("Not a word type");
        }
        return make.getWord(wordCell.spelling, wordCell.binding);
    },

    toLitWord(wordCell) {
        if (!isAnyWord(wordCell)) {
            throw new Error("Not a word type");
        }
        return make.litWord(wordCell.spelling, wordCell.binding);
    },
};

// Series navigation - returns NEW cell, same buffer, different position
export const series = {
    // Check if cell is a series type
    isSeries(cell) {
        return cell.type === TYPE.BLOCK ||
            cell.type === TYPE.STRING ||
            cell.type === TYPE.BINARY ||
            cell.type === TYPE.PAREN ||
            cell.type === TYPE.PATH;
    },

    // Move to next position
    next(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }

        const newIndex = Math.min(cell.index + 1, cell.buffer.length);
        return new ReCell(cell.type, {
            buffer: cell.buffer, // Same buffer!
            index: newIndex,
        });
    },

    // Move back one position
    back(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }

        const newIndex = Math.max(0, cell.index - 1);
        return new ReCell(cell.type, {
            buffer: cell.buffer,
            index: newIndex,
        });
    },

    // Skip n positions (can be negative)
    skip(cell, n) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }

        const newIndex = Math.max(
            0,
            Math.min(cell.index + n, cell.buffer.length),
        );
        return new ReCell(cell.type, {
            buffer: cell.buffer,
            index: newIndex,
        });
    },

    // Go to head
    head(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }

        return new ReCell(cell.type, {
            buffer: cell.buffer,
            index: 0,
        });
    },

    // Go to tail (past the end)
    tail(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }

        return new ReCell(cell.type, {
            buffer: cell.buffer,
            index: cell.buffer.length,
        });
    },

    // Check if at head
    isHead(cell) {
        return this.isSeries(cell) && cell.index === 0;
    },

    // Check if at tail
    isTail(cell) {
        return this.isSeries(cell) && cell.index >= cell.buffer.length;
    },

    // Get length from current position to tail
    length(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        return Math.max(0, cell.buffer.length - cell.index);
    },

    // Get 1-based index position (REBOL convention)
    indexOf(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        return cell.index + 1; // 1-based for users
    },

    // Access current value
    first(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        if (cell.index >= cell.buffer.length) {
            throw new Error("Out of range or past end");
        }
        return cell.buffer.data[cell.index];
    },

    // Pick value at offset (1-based)
    pick(cell, n) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        const targetIndex = cell.index + n - 1;
        if (targetIndex < 0 || targetIndex >= cell.buffer.length) {
            return make.none();
        }
        return cell.buffer.data[targetIndex];
    },

    // Mutation: Insert value at current position
    // Returns position AFTER the insert
    insert(cell, value) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        cell.buffer.data.splice(cell.index, 0, value);
        return this.next(cell);
    },

    // Mutation: Append to tail, return head
    append(cell, value) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        cell.buffer.data.push(value);
        return this.head(cell);
    },

    // Mutation: Remove current value
    // Returns same position (which now points to what was next)
    remove(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        if (cell.index < cell.buffer.length) {
            cell.buffer.data.splice(cell.index, 1);
        }
        return cell; // Same cell works since we're just returning props
    },

    // Mutation: Clear from current position to tail
    clear(cell) {
        if (!this.isSeries(cell)) {
            throw new Error("Not a series");
        }
        cell.buffer.data.splice(cell.index);
        return cell;
    },
};
