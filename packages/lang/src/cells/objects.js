import { Context } from "../context.js";
import { bind } from "../bind.js";
import { deepCopy } from "../copy.js";
import { isSeries } from "./series.js";
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
}
