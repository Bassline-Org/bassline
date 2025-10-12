// evaluate.test.js
import { describe, expect, it } from "vitest";
import { doBlock, evaluate, use } from "../../src/proper/evaluate.js";
import { Context } from "../../src/proper/context.js";
import { make, series } from "../../src/proper/cells.js";
import { bind } from "../../src/proper/bind.js";
import { normalize } from "../../src/proper/spelling.js";

describe("doBlock", () => {
    it("evaluates self-evaluating values", () => {
        const blk = make.block([make.num(42)]);
        const result = doBlock(blk);
        expect(result.type).toBe(make.num(42).type);
        expect(result.value).toBe(42);
    });

    it("handles simple assignment", () => {
        const ctx = new Context();
        const blk = make.block([
            make.setWord("x", ctx),
            make.num(42),
        ]);

        const result = doBlock(blk);

        expect(result.value).toBe(42);
        expect(ctx.get("x").value).toBe(42);
    });

    it("returns last value with multiple expressions", () => {
        const ctx = new Context();
        const blk = make.block([
            make.setWord("x", ctx),
            make.num(1),
            make.setWord("y", ctx),
            make.num(2),
        ]);

        const result = doBlock(blk);

        expect(result.value).toBe(2);
        expect(ctx.get("x").value).toBe(1);
        expect(ctx.get("y").value).toBe(2);
    });

    it("assigns looked-up values", () => {
        const ctx = new Context();
        ctx.set("x", make.num(100));

        const blk = make.block([
            make.setWord("y", ctx),
            make.word("x", ctx),
        ]);

        const result = doBlock(blk);

        expect(result.value).toBe(100);
        expect(ctx.get("y").value).toBe(100);
    });

    it("throws on SET_WORD at end of block", () => {
        const ctx = new Context();
        const blk = make.block([
            make.setWord("x", ctx),
        ]);

        expect(() => doBlock(blk)).toThrow("SET_WORD! at end of block");
    });

    it("throws on SET_WORD with no context", () => {
        const blk = make.block([
            make.setWord("x"), // No context!
            make.num(42),
        ]);

        expect(() => doBlock(blk)).toThrow("has no context");
    });

    it("evaluates non-block by calling evaluate", () => {
        const result = doBlock(make.num(42));
        expect(result.value).toBe(42);
    });
});

describe("use", () => {
    it("creates local context and evaluates body", () => {
        const globalCtx = new Context();
        globalCtx.set("x", make.num(99));

        // use ["a"] [a: 42]
        const body = make.block([
            make.setWord("a"), // Unbound initially
            make.num(42),
        ]);

        const result = use(["a"], body);

        expect(result.value).toBe(42);
        // Global x should be unchanged
        expect(globalCtx.get("x").value).toBe(99);
    });

    it("shadows outer variables", () => {
        const globalCtx = new Context();
        globalCtx.set("x", make.num(10));

        // Build: x: 5 (bound to global)
        const outerBody = make.block([
            make.setWord("x", globalCtx),
            make.num(5),
        ]);
        doBlock(outerBody);
        expect(globalCtx.get("x").value).toBe(5);

        // use ["x"] [x: 42]
        const useBody = make.block([
            make.setWord("x"),
            make.num(42),
        ]);

        use(["x"], useBody);

        // Global x should still be 5
        expect(globalCtx.get("x").value).toBe(5);
    });

    it("works with empty word list", () => {
        const ctx = new Context();
        ctx.set("x", make.num(10));

        const body = make.block([
            make.word("x", ctx),
        ]);

        const result = use([], body);
        expect(result.value).toBe(10);
    });
});
