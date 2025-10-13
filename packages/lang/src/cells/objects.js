import { bind } from "../bind.js";
import { Context } from "../context.js";
import { ReCell } from "./base.js";

export class ObjectCell extends ReCell {
    constructor() {
        super();
        this.__context = new Context();
    }

    set context(newContext) {
        this.__context = newContext;
        this.__context.set("self", this);
    }

    get context() {
        return this.__context;
    }

    typeName() {
        return "object!";
    }
    get(spelling) {
        return this.context.get(spelling);
    }
    set(spelling, cell) {
        return this.context.set(spelling, cell);
    }
}
