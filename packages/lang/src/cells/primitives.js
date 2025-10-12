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
