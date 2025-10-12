import { normalize } from "./spelling.js";

export class Context {
    constructor() {
        this.bindings = new Map();
    }

    /**
     * Access a value from the context according
     * to the spelling of a word
     * @param {*} spelling a string to normalize
     * @returns ReCell | undefined
     */
    get(spelling) {
        return this.bindings.get(normalize(spelling));
    }

    /**
     * Sets the value for a word spelling
     * to a particular cell
     * @param {*} spelling
     * @param {*} cell
     */
    set(spelling, cell) {
        this.bindings.set(normalize(spelling), cell);
    }
}

export const GLOBAL = new Context();
