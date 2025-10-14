import { normalize } from "./utils.js";

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
