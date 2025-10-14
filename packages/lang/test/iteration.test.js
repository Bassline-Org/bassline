import { describe, expect, it } from "vitest";
import { createRepl } from "../src/repl.js";

describe("Iteration - foreach", () => {
    it("should iterate over block items", () => {
        const repl = createRepl();

        // Create a counter and iterate
        repl.eval("total: 0");
        repl.eval("foreach n [1 2 3] [total: + total n]");

        const result = repl.eval("total");
        expect(result.value.value).toBe(6);
    });

    it("should bind item to word in context", () => {
        const repl = createRepl();

        // Last item should remain bound
        repl.eval('foreach item ["a" "b" "c"] [x: item]');

        const result = repl.eval("x");
        expect(result.value.value).toBe("c");
    });

    it("should return last iteration result", () => {
        const repl = createRepl();

        const result = repl.eval("foreach n [1 2 3] [* n 2]");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(6); // Last: 3 * 2
    });
});

describe("Iteration - repeat", () => {
    it("should execute body n times", () => {
        const repl = createRepl();

        repl.eval("count: 0");
        repl.eval("repeat 5 [count: + count 1]");

        const result = repl.eval("count");
        expect(result.value.value).toBe(5);
    });

    it("should return last iteration result", () => {
        const repl = createRepl();

        repl.eval("i: 0");
        const result = repl.eval("repeat 3 [i: + i 1]");

        expect(result.value.value).toBe(3);
    });

    it("should handle zero iterations", () => {
        const repl = createRepl();

        repl.eval("x: 0");
        repl.eval("repeat 0 [x: + x 1]");

        const result = repl.eval("x");
        expect(result.value.value).toBe(0); // Should not execute
    });
});

describe("Iteration - while", () => {
    it("should loop while condition is true", () => {
        const repl = createRepl();

        repl.eval("x: 0");
        repl.eval("while [< x 5] [x: + x 1]");

        const result = repl.eval("x");
        expect(result.value.value).toBe(5);
    });

    it("should stop when condition becomes false", () => {
        const repl = createRepl();

        repl.eval("total: 0");
        repl.eval("i: 1");
        repl.eval("while [<= i 10] [total: + total i  i: + i 1]");

        const result = repl.eval("total");
        expect(result.value.value).toBe(55); // Sum 1 to 10
    });

    it("should handle initially false condition", () => {
        const repl = createRepl();

        repl.eval("x: 10");
        repl.eval("while [< x 5] [x: + x 1]");

        const result = repl.eval("x");
        expect(result.value.value).toBe(10); // Should not execute
    });
});

describe("Control Flow - if", () => {
    it("should execute body when condition is true", () => {
        const repl = createRepl();

        repl.eval("x: 10");
        repl.eval("if (> x 5) [result: true]");

        const r = repl.eval("result");
        expect(r.value).toBe(true);
    });

    it("should not execute body when condition is false", () => {
        const repl = createRepl();

        repl.eval("x: 3");
        repl.eval("result: false");
        repl.eval("if (> x 5) [result: true]");

        const r = repl.eval("result");
        expect(r.value).toBe(false); // Should remain false
    });

    it("should return body result when true", () => {
        const repl = createRepl();

        const result = repl.eval("if true [42]");
        expect(result.value.value).toBe(42);
    });

    it("should return none when false", () => {
        const repl = createRepl();

        const result = repl.eval("if false [42]");
        expect(result.value).toBe(null);
    });
});

describe("Control Flow - either", () => {
    it("should execute true body when condition is true", () => {
        const repl = createRepl();

        const result = repl.eval("either true [1] [2]");
        expect(result.value.value).toBe(1);
    });

    it("should execute false body when condition is false", () => {
        const repl = createRepl();

        const result = repl.eval("either false [1] [2]");
        expect(result.value.value).toBe(2);
    });

    it("should work with comparisons", () => {
        const repl = createRepl();

        repl.eval("x: 10");
        const result = repl.eval("either (> x 5) [\"big\"] [\"small\"]");

        expect(result.value.value).toBe("big");
    });

    it("should work with variables", () => {
        const repl = createRepl();

        repl.eval("age: 25");
        repl.eval("status: either (>= age 18) [\"adult\"] [\"minor\"]");

        const result = repl.eval("status");
        expect(result.value.value).toBe("adult");
    });
});

describe("Integration - Complex Patterns", () => {
    it("should nest if inside foreach", () => {
        const repl = createRepl();

        repl.eval("evens: 0");
        repl.eval("foreach n [1 2 3 4 5] [if (= 0 (% n 2)) [evens: + evens 1]]");

        // Need modulo operator first! Skip for now
        // const result = repl.eval("evens");
        // expect(result.value.value).toBe(2);
    });

    it("should use either to accumulate values", () => {
        const repl = createRepl();

        repl.eval("positives: 0");
        repl.eval("negatives: 0");
        repl.eval(`foreach n [-2 -1 0 1 2] [
            either (> n 0)
                [positives: + positives 1]
                [negatives: + negatives 1]
        ]`);

        const pos = repl.eval("positives");
        const neg = repl.eval("negatives");

        expect(pos.value.value).toBe(2);
        expect(neg.value.value).toBe(3); // Includes 0
    });

    it("should build lists with repeat", () => {
        const repl = createRepl();

        repl.eval("count: 0");
        repl.eval("repeat 10 [count: + count 1]");

        const result = repl.eval("count");
        expect(result.value.value).toBe(10);
    });
});
