import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

describe("Arithmetic Operators", () => {
    it("should add two numbers", () => {
        const code = parse(`x: + 1 2`);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("X")).value).toBe(3);
    });

    it("should subtract two numbers", () => {
        const code = parse(`x: - 10 3`);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("X")).value).toBe(7);
    });

    it("should multiply two numbers", () => {
        const code = parse(`x: * 4 5`);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("X")).value).toBe(20);
    });

    it("should divide two numbers", () => {
        const code = parse(`x: / 20 4`);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("X")).value).toBe(5);
    });

    it("should handle nested arithmetic", () => {
        const code = parse(`
            a: + 1 2
            b: * a 3
            c: - b 1
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A")).value).toBe(3);
        expect(context.get(Symbol.for("B")).value).toBe(9);
        expect(context.get(Symbol.for("C")).value).toBe(8);
    });
});

describe("Comparison Operators", () => {
    it("should test equality", () => {
        const code = parse(`
            a: = 1 1
            b: = 1 2
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(false);
    });

    it("should test less than", () => {
        const code = parse(`
            a: < 1 2
            b: < 2 1
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(false);
    });

    it("should test greater than", () => {
        const code = parse(`
            a: > 2 1
            b: > 1 2
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(false);
    });

    it("should test less than or equal", () => {
        const code = parse(`
            a: <= 1 2
            b: <= 2 2
            c: <= 3 2
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(true);
        expect(context.get(Symbol.for("C"))).toBe(false);
    });

    it("should test greater than or equal", () => {
        const code = parse(`
            a: >= 2 1
            b: >= 2 2
            c: >= 1 2
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(true);
        expect(context.get(Symbol.for("C"))).toBe(false);
    });

    it("should test inequality", () => {
        const code = parse(`
            a: not= 1 2
            b: not= 1 1
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(false);
    });
});

describe("Boolean Values", () => {
    it("should have true and false words", () => {
        const code = parse(`
            a: true
            b: false
        `);
        const context = createPreludeContext();
        ex(context, code);
        expect(context.get(Symbol.for("A"))).toBe(true);
        expect(context.get(Symbol.for("B"))).toBe(false);
    });
});
