import { ReCell } from "./base.js";

/**
 * None cell - represents absence of value
 */
export class NoneCell extends ReCell {}

/**
 * Number cell - represents numeric values
 */
export class NumberCell extends ReCell {
    constructor(value) {
        super();
        this.value = value;
    }
}

/**
 * File cell - represents file paths (%file.txt)
 * Intrinsic type - self-evaluating, no binding
 */
export class FileCell extends ReCell {
    constructor(path) {
        super();
        this.path = path; // Static string, no evaluation
    }
}

/**
 * Tuple cell - represents tuples (1.2.3.4)
 * Intrinsic type - self-evaluating, no binding
 */
export class TupleCell extends ReCell {
    constructor(numbers) {
        super();
        this.numbers = numbers; // Array of integers: [1, 2, 3, 4]
    }
}

/**
 * URL cell - represents URLs (http://example.com)
 * Intrinsic type - self-evaluating, no binding
 */
export class UrlCell extends ReCell {
    constructor(url) {
        super();
        this.url = url; // Static string
    }
}
