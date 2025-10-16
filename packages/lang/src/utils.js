import { Block } from "./datatypes/core.js";
export function normalize(str) {
    if (typeof str === "symbol") {
        return Symbol.for(str.description.trim().toUpperCase());
    }
    return Symbol.for(str.trim().toUpperCase());
}

export function isa(value, aClass) {
    return value instanceof aClass;
}

export function isSelfEvaluating(value) {
    return typeof value === "number" ||
        typeof value === "string" ||
        isa(value, Block);
}

export class Stream {
    constructor(array) {
        this.items = array;
        this.index = 0;
    }

    next() {
        return this.items[this.index++];
    }

    peek(offset = 0) {
        return this.items[this.index + offset];
    }

    done() {
        return this.items.length <= this.index;
    }

    // Consume and validate type/spelling
    expect(type, spelling = null) {
        const val = this.next();
        if (!isa(val, type)) {
            throw new Error(
                `Expected ${type.name}, got ${val?.constructor.name}`,
            );
        }
        if (spelling && val.spelling !== normalize(spelling)) {
            throw new Error(
                `Expected ${spelling}, got ${val.spelling.description}`,
            );
        }
        return val;
    }

    // Check if next matches type/spelling (without consuming)
    match(type, spelling = null) {
        const val = this.peek();
        if (!val || !isa(val, type)) return false;
        if (spelling && val.spelling !== normalize(spelling)) return false;
        return true;
    }

    // Try to consume if matches, return null otherwise
    consume(type, spelling = null) {
        if (this.match(type, spelling)) {
            return this.next();
        }
        return null;
    }

    // Save position for backtracking
    save() {
        return this.index;
    }

    // Restore position
    restore(index) {
        this.index = index;
    }
}
