// test/objects.test.js
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { Context } from "../src/context.js";
import { normalize } from "../src/spelling.js";

describe("Objects", () => {
    it("creates simple object", () => {
        const result = run(`
            obj: make object! [x: 42]
            obj
        `);
        expect(result).toBeInstanceOf(Context);
        expect(result.get(normalize("x")).value).toBe(42);
    });

    it("object has self reference", () => {
        const result = run(`
            obj: make object! [x: 10]
            obj
        `);
        expect(result.get(normalize("self"))).toBe(result);
    });

    it("fields can reference each other", () => {
        const result = run(`
            obj: make object! [
                x: 10
                y: + x 5
            ]
            obj
        `);
        expect(result.get(normalize("y")).value).toBe(15);
    });

    it("can define methods", () => {
        const result = run(`
            obj: make object! [
                x: 10
                double: func [] [* x 2]
            ]
            obj
        `);
        const method = result.get(normalize("double"));
        expect(method.typeName).toBe("function");
    });
});

describe("Path Evaluation", () => {
    it("accesses object field", () => {
        const result = run(`
            obj: make object! [x: 42]
            obj/x
        `);
        expect(result.value).toBe(42);
    });

    it("accesses multiple fields", () => {
        const result = run(`
            obj: make object! [
                x: 100
                y: 200
            ]
            + obj/x obj/y
        `);
        expect(result.value).toBe(300);
    });

    it("calls object method", () => {
        const result = run(`
            obj: make object! [
                x: 21
                double: func [] [* x 2]
            ]
            obj/double
        `);
        expect(result.value).toBe(42);
    });

    it("handles nested objects", () => {
        const result = run(`
            outer: make object! [
                inner: make object! [
                    value: 99
                ]
            ]
            outer/inner/value
        `);
        expect(result.value).toBe(99);
    });

    it("accesses block by index", () => {
        const result = run(`
            blk: [10 20 30]
            blk/2
        `);
        expect(result.value).toBe(20); // 1-based indexing
    });

    it("throws on missing field", () => {
        expect(() =>
            run(`
            obj: make object! [x: 10]
            obj/missing
        `)
        ).toThrow(/not found/);
    });
});
