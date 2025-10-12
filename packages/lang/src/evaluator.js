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

    /**
     * Execute a block of code
     * @param {BlockCell} blockCell
     * @returns {ReCell}
     */
    doBlock(blockCell) {
        // If it's not a series or not a block, just evaluate it
        if (!isSeries(blockCell) || !(blockCell instanceof BlockCell)) {
            return this.evaluate(blockCell);
        }

        let result = make.none();
        let pos = blockCell;

        while (!pos.isTail()) {
            const cell = pos.first();

            // Step this cell - it knows how to execute itself
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
