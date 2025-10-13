// test/metaprogramming.test.js
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { BlockCell } from "../src/cells/index.js";

describe("REDUCE", () => {
    it("evaluates all expressions", () => {
        const result = run(`
            reduce [+ 1 1 + 2 2]
        `);
        expect(result).toBeInstanceOf(BlockCell);
        expect(result.buffer[0].value).toBe(2);
        expect(result.buffer[1].value).toBe(4);
    });

    it("evaluates word lookups", () => {
        const result = run(`
            x: 42
            reduce [x x]
        `);
        expect(result.buffer[0].value).toBe(42);
        expect(result.buffer[1].value).toBe(42);
    });

    it("evaluates function calls", () => {
        const result = run(`
            double: func [n] [* n 2]
            reduce [double 5 double 10]
        `);
        expect(result.buffer[0].value).toBe(10);
        expect(result.buffer[1].value).toBe(20);
    });

    it("handles mixed values", () => {
        const result = run(`
            x: 10
            reduce [x + x 5 * 2 3]
        `);
        expect(result.buffer.length).toBe(3); // Not 4!
        expect(result.buffer[0].value).toBe(10);
        expect(result.buffer[1].value).toBe(15);
        expect(result.buffer[2].value).toBe(6);
    });

    it("handles nested blocks literally", () => {
        const result = run(`
            reduce [[1 2] [3 4]]
        `);
        expect(result.buffer.length).toBe(2);
        expect(result.buffer[0]).toBeInstanceOf(BlockCell);
        expect(result.buffer[1]).toBeInstanceOf(BlockCell);
    });
});

describe("COMPOSE", () => {
    it("only evaluates parens", () => {
        const result = run(`
            compose [a (+ 1 1) b (+ 2 2)]
        `);
        expect(result.buffer.length).toBe(4);
        // 'a' stays as word
        expect(result.buffer[0].typeName).toBe("word");
        // (+ 1 1) becomes 2
        expect(result.buffer[1].value).toBe(2);
        // 'b' stays as word
        expect(result.buffer[2].typeName).toBe("word");
        // (+ 2 2) becomes 4
        expect(result.buffer[3].value).toBe(4);
    });

    it("leaves words unevaluated", () => {
        const result = run(`
            x: 42
            compose [x: (x)]
        `);
        expect(result.buffer.length).toBe(2);
        // x: stays as set-word
        expect(result.buffer[0].typeName).toBe("setword");
        // (x) becomes 42
        expect(result.buffer[1].value).toBe(42);
    });

    it("composes nested blocks", () => {
        const result = run(`
            compose [a [b (+ 1 1) c] d]
        `);
        const nested = result.buffer[1];
        expect(nested).toBeInstanceOf(BlockCell);
        expect(nested.buffer[0].typeName).toBe("word"); // b
        expect(nested.buffer[1].value).toBe(2); // (+ 1 1)
        expect(nested.buffer[2].typeName).toBe("word"); // c
    });

    it("builds dynamic code", () => {
        const result = run(`
            op: '+
            val: 10
            code: compose [(op) 5 (val)]
            do code
        `);
        expect(result.value).toBe(15);
    });
});

describe("Metaprogramming Patterns", () => {
    it("builds function call dynamically", () => {
        const result = run(`
            double: func [x] [* x 2]
            fn: 'double
            arg: 21
            code: reduce [fn arg]
            do code
        `);
        expect(result.value).toBe(42);
    });

    it("builds object spec dynamically with compose", () => {
        const result = run(`
            fieldValue: 99
            obj: make object! compose [x: (fieldValue)]
            obj/x
        `);
        expect(result.value).toBe(99);
    });

    it("combines reduce and compose", () => {
        const result = run(`
            x: 10
            y: 20
            ; Compose structure, reduce values
            data: compose [
                sum: (reduce [x y])
                total: (+ x y)
            ]
            data
        `);
        expect(result.buffer.length).toBe(4);
        // sum: [10 20]
        expect(result.buffer[1]).toBeInstanceOf(BlockCell);
        // total: 30
        expect(result.buffer[3].value).toBe(30);
    });

    it("builds gadget-style messages", () => {
        const result = run(`
            gadgetId: 42
            currentValue: 100
            timestamp: 1234567
            
            msg: reduce [
                'gadget-id gadgetId
                'value currentValue
                'timestamp timestamp
            ]
            msg
        `);
        expect(result.buffer.length).toBe(6);
        expect(result.buffer[0].typeName).toBe("word"); // 'gadget-id
        expect(result.buffer[1].value).toBe(42); // 42
        expect(result.buffer[2].typeName).toBe("word"); // 'value
        expect(result.buffer[3].value).toBe(100); // 100
    });
});
