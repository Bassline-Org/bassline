import { Context } from "../context.js";
import { bind } from "../bind.js";
import { deepCopy } from "../copy.js";
import { isSeries } from "./series.js";
import { ReCell } from "./base.js";

export class ObjectCell extends ReCell {
    constructor(spec) {
        if (!isSeries(spec)) {
            throw new Error("make object!: spec must be a block");
        }
        // Setup the object context
        this.objContext = new Context();

        // Add self reference
        this.objContext.set("self", this.objContext);

        const specCopy = deepCopy(spec);
        // Bind the spec to the object context
        bind(specCopy, this.objContext);
        // Add the spec reference to the object context
        this.objContext.set("_spec", specCopy);

        specCopy.evaluate(this.objContext);
    }

    typeName() {
        return "object!";
    }
}
