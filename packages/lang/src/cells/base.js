/**
 * Base class for all cells.
 * Defines the protocol every cell must implement.
 */
export class ReCell {
    /**
     * Freeze this cell to make it immutable.
     * @returns {ReCell} this cell (frozen)
     */
    freeze() {
        return Object.freeze(this);
    }

    /**
     * Evaluate this cell.
     * Default: self-evaluating (returns itself)
     * @param {Evaluator} evaluator - The evaluator context
     * @returns {ReCell} The evaluated result
     */
    evaluate(evaluator) {
        return this;
    }

    /**
     * Execute this cell and consume from the code stream.
     * Returns the result value and how many positions were consumed.
     *
     * @param {ReCell} codeStream - Current position in code (series cell)
     * @param {Evaluator} evaluator - The evaluator context
     * @returns {{value: ReCell, consumed: number}}
     */
    step(codeStream, evaluator) {
        // Default: evaluate self, consume 1 position
        const value = this.evaluate(evaluator);
        return { value, consumed: 1 };
    }

    /**
     * Check if this cell can consume arguments (is it applicable/callable?)
     * @returns {boolean}
     */
    isApplicable() {
        return false;
    }

    /**
     * Get the type name for this cell.
     * @returns {string}
     */
    get typeName() {
        return this.constructor.name.replace("Cell", "").toLowerCase();
    }
}
