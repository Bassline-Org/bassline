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
