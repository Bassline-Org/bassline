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
     * @param {StreamController} control - The stream controller
     * @returns {ReCell} The evaluated result
     */
    evaluate(control) {
        return this;
    }

    /**
     * Get the type name for this cell.
     * @returns {string}
     */
    get typeName() {
        return this.constructor.name.replace("Cell", "").toLowerCase();
    }
}

export class ApplicableCell extends ReCell {
    constructor() {
        super();
        this.isApplicable = true;
    }
}
