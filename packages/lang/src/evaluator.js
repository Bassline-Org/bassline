import { BlockCell, isSeries, series } from "./cells/index.js";
import { make } from "./cells/index.js";

/**
 * The evaluator - orchestrates cell execution
 */
export class Evaluator {
    constructor() {
        // Make series utilities available to cells during step()
        this.series = series;
    }

    /**
     * Evaluate a single cell
     * @param {ReCell} cell
     * @returns {ReCell}
     */
    evaluate(cell) {
        return cell.evaluate(this);
    }

    // evaluator.js
    doBlock(blockCell) {
        // If it's not a series, just evaluate it
        if (!isSeries(blockCell)) {
            return this.evaluate(blockCell);
        }

        // Now we know it's a series - execute it
        let result = make.none();
        let pos = blockCell;

        while (!pos.isTail()) {
            const cell = pos.first();
            const { value, consumed } = cell.step(pos, this);
            result = value;
            pos = pos.skip(consumed);
        }

        return result;
    }
}

// Global evaluator instance
const globalEvaluator = new Evaluator();

/**
 * Convenience function - evaluate a cell
 */
export function evaluate(cell) {
    return globalEvaluator.evaluate(cell);
}

/**
 * Convenience function - execute a block
 */
export function doBlock(cell) {
    return globalEvaluator.doBlock(cell);
}
