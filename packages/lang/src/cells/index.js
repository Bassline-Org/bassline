// Export all cell types
export { ReCell } from "./base.js";
export { NoneCell, NumberCell } from "./primitives.js";
export {
    GetWordCell,
    isAnyWord,
    LitWordCell,
    RefinementCell,
    SetWordCell,
    WordCell,
    wordConvert,
} from "./words.js";
export {
    BinaryCell,
    BlockCell,
    isSeries,
    ParenCell,
    PathCell,
    series,
    SeriesBuffer,
    StringCell,
} from "./series.js";
export { FunctionCell, makeFunc, RFunction } from "./functions.js";

import { NoneCell, NumberCell } from "./primitives.js";
import {
    GetWordCell,
    LitWordCell,
    RefinementCell,
    SetWordCell,
    WordCell,
} from "./words.js";
import {
    BinaryCell,
    BlockCell,
    ParenCell,
    PathCell,
    SeriesBuffer,
    StringCell,
} from "./series.js";
import { FunctionCell } from "./functions.js";

/**
 * Factory functions for creating cells
 * All cells are frozen (immutable)
 */
export const make = {
    none() {
        return new NoneCell().freeze();
    },

    num(number = 0) {
        return new NumberCell(number).freeze();
    },

    word(spelling, binding) {
        return new WordCell(spelling, binding).freeze();
    },

    setWord(spelling, binding) {
        return new SetWordCell(spelling, binding).freeze();
    },

    getWord(spelling, binding) {
        return new GetWordCell(spelling, binding).freeze();
    },

    litWord(spelling, binding) {
        return new LitWordCell(spelling, binding).freeze();
    },

    refinement(spelling) {
        return new RefinementCell(spelling).freeze();
    },

    // Series constructors
    block(values = []) {
        return new BlockCell(new SeriesBuffer(values)).freeze();
    },

    string(str = "") {
        return new StringCell(str).freeze();
    },

    binary(bytes = []) {
        return new BinaryCell(new SeriesBuffer(bytes)).freeze();
    },

    paren(values = []) {
        return new ParenCell(new SeriesBuffer(values)).freeze();
    },

    path(values = []) {
        return new PathCell(new SeriesBuffer(values)).freeze();
    },

    fn(rfunc) {
        return new FunctionCell(rfunc).freeze();
    },
};
