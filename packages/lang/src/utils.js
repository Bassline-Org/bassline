import { Block, Scalar } from "./values.js";
export function normalize(str) {
    if (typeof str === "symbol") return str;
    return Symbol.for(str.trim().toUpperCase());
}

export function isa(value, aClass) {
    return value instanceof aClass;
}

export function isSelfEvaluating(value) {
    return isa(value, Scalar) || isa(value, Block);
}

export class Stream {
    constructor(array) {
        this.items = array;
        this.index = 0;
    }

    next() {
        return this.items[this.index++];
    }

    peek() {
        return this.items[this.index];
    }

    done() {
        return this.items.length <= this.index;
    }
}
