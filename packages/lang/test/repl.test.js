import { describe, expect, it } from "vitest";
import { createRepl } from "../repl.js";

describe("REPL - Safe Evaluation", () => {
    it("should handle successful evaluation", async () => {
        const repl = createRepl();
        const result = await repl.eval("x: 5");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(5);
    });

    it("should handle parse errors without crashing", async () => {
        const repl = createRepl();
        const result = await repl.eval("bad syntax [[[");
        // Parser logs to stderr but returns error
        expect(result.ok).toBe(false);
        // Note: error might be undefined because parser prints to stderr
        // This is acceptable - the important part is ok: false
    });

    it("should handle undefined variables", async () => {
        const repl = createRepl();
        // undefined-var evaluates to undefined/none, gets passed to +
        // Arithmetic with undefined produces NaN
        const result = await repl.eval("+ undefined-var 5");
        // This succeeds but returns NaN
        expect(result.ok).toBe(true);
        expect(Number.isNaN(result.value.value)).toBe(true);
    });

    it("should maintain state across evaluations", async () => {
        const repl = createRepl();

        let result = await repl.eval("x: 10");
        expect(result.ok).toBe(true);

        result = await repl.eval("y: + x 5");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(15);

        result = await repl.eval("y");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(15);
    });

    it("should continue working after errors", async () => {
        const repl = createRepl();

        // First a bad eval
        let result = await repl.eval("bad [[[");
        expect(result.ok).toBe(false);

        // Should still work
        result = await repl.eval("x: 42");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(42);
    });
});

describe("Type Predicates", () => {
    it("should check block?", async () => {
        const repl = createRepl();
        let result = await repl.eval("block? [1 2 3]");
        expect(result.value).toBe(true);

        result = await repl.eval("block? 5");
        expect(result.value).toBe(false);
    });

    it("should check paren?", async () => {
        const repl = createRepl();
        let result = await repl.eval("paren? (1 2 3)");
        expect(result.value).toBe(true);

        result = await repl.eval("paren? [1 2 3]");
        expect(result.value).toBe(false);
    });

    it("should check num?", async () => {
        const repl = createRepl();
        let result = await repl.eval("num? 42");
        expect(result.value).toBe(true);

        result = await repl.eval('num? "hello"');
        expect(result.value).toBe(false);
    });

    it("should check str?", async () => {
        const repl = createRepl();
        let result = await repl.eval('str? "hello"');
        expect(result.value).toBe(true);

        result = await repl.eval("str? 42");
        expect(result.value).toBe(false);
    });

    it("should check word?", async () => {
        const repl = createRepl();
        let result = await repl.eval("word? x");
        expect(result.value).toBe(true);

        result = await repl.eval("word? 42");
        expect(result.value).toBe(false);
    });

    it("should check context?", async () => {
        const repl = createRepl();
        await repl.eval("ctx: context");
        await repl.eval("in ctx [x: 5]");
        let result = await repl.eval("context? ctx");
        expect(result.value).toBe(true);

        result = await repl.eval("context? 42");
        expect(result.value).toBe(false);
    });
});

describe("System Reflection", () => {
    it("should have system bound to prelude context", async () => {
        const repl = createRepl();
        const result = await repl.eval("context? system");
        expect(result.value).toBe(true);
    });

    it("should be able to introspect system bindings", async () => {
        const repl = createRepl();
        // Set a value
        await repl.eval("myvar: 42");

        // Access it through system
        const result = await repl.eval("in system [myvar]");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(42);
    });

    it("should allow checking if words are bound", async () => {
        const repl = createRepl();
        await repl.eval("x: 10");

        // Check if x is in system context
        const result = await repl.eval("in system [x]");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(10);
    });
});
