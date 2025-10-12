// test/integration.test.js
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";

describe("Parser + Runtime Integration", () => {
    it("runs simple arithmetic", () => {
        const result = run("+ 2 3");
        expect(result.value).toBe(5);
    });

    it("handles variable assignment and lookup", () => {
        const result = run("x: 42  y: + x 10  y");
        expect(result.value).toBe(52);
    });

    it("defines and calls functions", () => {
        const result = run("double: func [x] [+ x x]  double 21");
        expect(result.value).toBe(42);
    });

    it("handles recursion", () => {
        const result = run(`
            factorial: func [n] [
                either <= n 1 
                    [1]
                    [* n factorial - n 1]
            ]
            factorial 5
        `);
        expect(result.value).toBe(120);
    });
});
describe("Integration: Parser + Runtime", () => {
    it("runs simple arithmetic", () => {
        const result = run("+ 2 3");
        expect(result.value).toBe(5);
    });

    it("handles variables", () => {
        const result = run("x: 42  y: + x 10  y");
        expect(result.value).toBe(52);
    });

    it("defines and calls simple function", () => {
        const result = run(`
            double: func [x] [+ x x]
            double 21
        `);
        expect(result.value).toBe(42);
    });

    it("defines function with multiple parameters", () => {
        const result = run(`
            add3: func [a b c] [+ a + b c]
            add3 10 20 30
        `);
        expect(result.value).toBe(60);
    });

    it("handles function with local variables", () => {
        const result = run(`
            test: func [x] [
                temp: + x 10
                result: * temp 2
                result
            ]
            test 5
        `);
        expect(result.value).toBe(30);
    });

    it("handles recursion - factorial", () => {
        const result = run(`
            factorial: func [n] [
                either <= n 1
                    [1]
                    [* n factorial - n 1]
            ]
            factorial 5
        `);
        expect(result.value).toBe(120);
    });

    it("handles recursion - fibonacci", () => {
        const result = run(`
            fib: func [n] [
                either <= n 1
                    [n]
                    [+ fib - n 1 fib - n 2]
            ]
            fib 10
        `);
        expect(result.value).toBe(55);
    });

    it("handles nested function calls", () => {
        const result = run(`
            inc: func [x] [+ x 1]
            dec: func [x] [- x 1]
            inc dec inc 10
        `);
        expect(result.value).toBe(11);
    });

    it("functions can access global variables", () => {
        const result = run(`
            globalX: 100
            useGlobal: func [y] [+ globalX y]
            useGlobal 23
        `);
        expect(result.value).toBe(123);
    });

    it("parameters shadow globals", () => {
        const result = run(`
            x: 999
            shadow: func [x] [x]
            shadow 42
        `);
        expect(result.value).toBe(42);
    });
});

describe("Integration: Control Flow", () => {
    it("if with true condition", () => {
        const result = run(`
            x: 0
            if 1 [x: 42]
            x
        `);
        expect(result.value).toBe(42);
    });

    it("if with false condition", () => {
        const result = run(`
            x: 0
            if 0 [x: 42]
            x
        `);
        expect(result.value).toBe(0);
    });

    it("either branches correctly", () => {
        const result = run(`
            test: func [n] [
                either > n 10
                    ["big"]
                    ["small"]
            ]
            test 15
        `);
        expect(result.buffer.data.join("")).toBe("big");
    });

    it("while loop", () => {
        const result = run(`
            sum: 0
            i: 1
            while [<= i 5] [
                sum: + sum i
                i: + i 1
            ]
            sum
        `);
        expect(result.value).toBe(15);
    });
});

describe("Integration: Series Operations", () => {
    it("works with blocks", () => {
        const result = run(`
            blk: [1 2 3]
            first blk
        `);
        expect(result.value).toBe(1);
    });

    it("navigates series", () => {
        const result = run(`
            blk: [10 20 30]
            first next blk
        `);
        expect(result.value).toBe(20);
    });

    it("iterates with while and series", () => {
        const result = run(`
            nums: [1 2 3 4 5]
            sum: 0
            pos: nums
            while [not tail? pos] [
                sum: + sum first pos
                pos: next pos
            ]
            sum
        `);
        expect(result.value).toBe(15);
    });
});
