import { isAnyWord, isSeries, SeriesBuffer } from "./cells/index.js";

/**
 * Deep copy a cell.
 * Creates new cells for words and recursively copies series.
 * Numbers and other immutable values are returned as-is.
 */
export function deepCopy(cell) {
    // Words need new cells (different identity, but same spelling/binding)
    if (isAnyWord(cell)) {
        const CellClass = cell.constructor;
        return new CellClass(cell.spelling, cell.binding).freeze();
    }

    // Series need new buffers with recursively copied contents
    if (isSeries(cell)) {
        const newData = cell.buffer.map((item) => deepCopy(item));
        const newBuffer = new SeriesBuffer(newData);

        const CellClass = cell.constructor;
        return new CellClass(newBuffer, cell.index).freeze();
    }

    // Everything else (numbers, none, etc.) is immutable
    // and can be returned as-is
    return cell;
}
export function normalize(str) {
    if (typeof str === "symbol") return str;
    return Symbol.for(str.trim().toUpperCase());
}
