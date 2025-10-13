import { NativeFn } from "./cells/natives.js";
import { normalize } from "./spelling.js";

export class Context {
    constructor() {
        this.bindings = new Map();
    }

    get(spelling) {
        return this.bindings.get(normalize(spelling));
    }

    set(spelling, cell) {
        this.bindings.set(normalize(spelling), cell);
    }
}

export const GLOBAL = new Context();
