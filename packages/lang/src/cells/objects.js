import { Context } from "../context.js";
import { ReCell } from "./base.js";
import { WordCell } from "./words.js";

export class ObjectCell extends ReCell {
    constructor() {
        super();
        this.context = new Context();
        this.context.set("self", this);
        this.isObject = true;
    }

    self() {
        const cell = new WordCell("self");
        cell.binding = this.context;
        return cell;
    }

    /**
     * Navigate by key (for paths)
     * @param {Symbol} key - Word spelling
     */
    get(key) {
        if (typeof key !== "symbol") {
            throw new Error(`Cannot index object with ${typeof key}`);
        }
        return this.context.get(key);
    }

    set(key, value) {
        if (typeof key !== "symbol") {
            throw new Error(`Cannot set object field with ${typeof key}`);
        }
        this.context.set(key, value);
        return this;
    }
}
