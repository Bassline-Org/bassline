import { ReCell } from "./base.js";

export class RFunction extends ReCell {
    constructor(spec, body) {
        super();
        this.spec = spec; // Array of parameter Symbols
        this.body = body; // Bound body block cell
    }

    /**
     * Execute this function with the given arguments
     * @param {Array<ReCell>} args - Evaluated arguments
     * @param {Evaluator} evaluator - The evaluator
     * @returns {ReCell}
     */
    evaluate(stream) {
        const args = this.spec.map((param) => stream.evalNext());

        // Execute the body
        const result = evaluator.doBlock(this.body);

        // Restore for recursion
        this.recursionLevel--;
        if (this.recursionLevel > 0) {
            const oldValues = callStack.pop();
            for (let i = 0; i < this.spec.length; i++) {
                this.context.set(this.spec[i], oldValues[i]);
            }
        }

        return result;
    }
}
