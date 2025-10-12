// computed-binding-bugs.test.js
import { describe, expect, it } from "vitest";
import { doBlock, use } from "../../src/proper/evaluate.js";
import { makeObject } from "../../src/proper/object.js";
import {
    isAnyWord,
    make,
    ReCell,
    SeriesBuffer,
    TYPE,
} from "../../src/proper/cells.js";

describe("bindology known bugs", () => {
    it("demonstrates the recursive USE bug", () => {
        // From bindology: This function has a bug due to body modification
        // f: func [x] [
        //     use [a] [
        //         either x = 1 [
        //             a: "OK"
        //             f 2
        //             a
        //         ] [
        //             a: "BUG!"
        //             "OK"
        //         ]
        //     ]
        // ]
        // f 1 ; == "BUG!" (incorrect, should be "OK")

        // Simulate this: we'll manually track the execution
        let callCount = 0;

        const body = make.block([
            make.setWord("a"),
            make.string("INITIAL"),
        ]);

        // First call
        callCount++;
        use(["a"], body);
        const firstBinding = body.buffer.data[0].binding;

        // Second call with SAME body
        callCount++;
        use(["a"], body);
        const secondBinding = body.buffer.data[0].binding;

        // The bug: body was mutated, so second USE rebinds to a NEW context
        expect(firstBinding).not.toBe(secondBinding);

        // This demonstrates why we need copy/deep!
    });

    it("demonstrates the recursive MAKE OBJECT! bug", () => {
        // From bindology:
        // f: func [x] [
        //     get in make object! [
        //         a: "OK"
        //         if x = 1 [
        //             a: "BUG!"
        //             f 2
        //             a: "OK"
        //         ]
        //     ] 'a
        // ]
        // f 1 ; == "BUG!" (should be "OK")

        const spec = make.block([
            make.setWord("a"),
            make.string("VALUE"),
        ]);

        // First makeObject call
        const obj1 = makeObject(spec);
        const firstBinding = spec.buffer.data[0].binding;

        // Second makeObject call with SAME spec
        const obj2 = makeObject(spec);
        const secondBinding = spec.buffer.data[0].binding;

        // The bug: spec was mutated, so it's now bound to obj2's context
        expect(firstBinding).toBe(obj1);
        expect(secondBinding).toBe(obj2);
        expect(firstBinding).not.toBe(secondBinding);

        // Both objects were affected because they share the spec!
    });
});

describe("fixing the bugs with copy/deep", () => {
    it("non-mutating USE prevents the bug", () => {
        // Implement a safe version that copies
        function nmUse(wordsArray, bodyCell) {
            // Copy the body deeply first
            const bodyCopy = copyDeep(bodyCell);
            return use(wordsArray, bodyCopy);
        }

        // Helper to deep copy (we'll need to implement this)
        function copyDeep(cell) {
            if (cell.type === TYPE.BLOCK) {
                const newData = cell.buffer.data.map((elem) => copyDeep(elem));
                const newBuffer = new SeriesBuffer(newData);
                return new ReCell(cell.type, {
                    buffer: newBuffer,
                    index: cell.index,
                });
            }
            // For words, create new unbound cells
            if (isAnyWord(cell)) {
                return new ReCell(cell.type, {
                    spelling: cell.spelling,
                    binding: undefined, // Unbound!
                });
            }
            return cell;
        }

        const body = make.block([
            make.setWord("a"),
            make.string("VALUE"),
        ]);

        // First call
        nmUse(["a"], body);
        // Original body is UNCHANGED
        expect(body.buffer.data[0].binding).toBeUndefined();

        // Second call
        nmUse(["a"], body);
        // Still unchanged
        expect(body.buffer.data[0].binding).toBeUndefined();
    });
});
