import { isAnyWord, ReCell, series, SeriesBuffer } from "./cells.js";

/**
 * Deep copy a block (or any cell).
 * Creates new cells for all word types and recursively copies series.
 * Numbers and other immutable values are returned as-is.
 */
export function deepCopy(cell) {
    // Words need new cells (different identity, but same spelling/binding)
    if (isAnyWord(cell)) {
        return new ReCell(cell.type, {
            spelling: cell.spelling,
            binding: cell.binding,
        });
    }

    // Series need new buffers with recursively copied contents
    if (series.isSeries(cell)) {
        const newData = cell.buffer.data.map((item) => deepCopy(item));
        const newBuffer = new SeriesBuffer(newData);

        return new ReCell(cell.type, {
            buffer: newBuffer,
            index: cell.index,
        });
    }

    // Everything else (numbers, none, etc.) is immutable
    // and can be returned as-is
    return cell;
}
