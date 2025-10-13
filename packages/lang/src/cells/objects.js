import { Context } from "../context.js";
import { ReCell } from "./base.js";

export class ObjectCell extends ReCell {
    constructor() {
        super();
        this.context = new Context();
        this.context.set("self", this);
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
