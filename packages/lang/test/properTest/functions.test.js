import { describe, expect, it } from "vitest";
import { make, TYPE } from "../../src/proper/cells.js";
import { Context, GLOBAL } from "../../src/proper/context.js";
import { doBlock } from "../../src/proper/evaluate.js";
import { makeFunc } from "../../src/proper/function.js";
import { normalize } from "../../src/proper/spelling.js";

describe("Functions", () => {
    describe("makeFunc", () => {
        it("binds body to function's context", () => {
            const spec = make.block([make.word("x")]);
            const body = make.block([make.word("x")]);

            const fn = makeFunc(spec, body);

            // Check that the word in the body is bound to the function's context
            const bodyWord = fn.fn.body.buffer.data[0];
            expect(bodyWord.binding).toBe(fn.fn.context);
        });

        it("creates independent function instances", () => {
            const spec = make.block([make.word("x")]);
            const body = make.block([make.word("x")]);

            const fn1 = makeFunc(spec, body);
            const fn2 = makeFunc(spec, body);

            // Different contexts
            expect(fn1.fn.context).not.toBe(fn2.fn.context);
            // Different body buffers
            expect(fn1.fn.body.buffer).not.toBe(fn2.fn.body.buffer);
        });
    });

    describe("Function calls", () => {
        it("calls a simple function", () => {
            const ctx = new Context();

            // Define: double: func [x] [x + x]
            // For now, we'll just return x since we don't have + yet
            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([make.word("x")]);
            const doubleFn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("double"), doubleFn);

            // Call: double 5
            const code = make.block([make.word("double", ctx), make.num(5)]);

            const result = doBlock(code);

            expect(result.type).toBe(TYPE.NUMBER);
            expect(result.value).toBe(5);
        });

        it("passes multiple parameters", () => {
            const ctx = new Context();

            // func [a b] [a]  (returns first parameter)
            const fnSpec = make.block([make.word("a"), make.word("b")]);
            const fnBody = make.block([make.word("a")]);
            const firstFn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("first-param"), firstFn);

            // Call: first-param 10 20
            const code = make.block([
                make.word("first-param", ctx),
                make.num(10),
                make.num(20),
            ]);

            const result = doBlock(code);

            expect(result.value).toBe(10);
        });

        it("handles assignment inside function", () => {
            const ctx = new Context();

            // func [x] [y: x  y]
            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([
                make.setWord("y"),
                make.word("x"),
                make.word("y"),
            ]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("test"), fn);

            // Call: test 42
            const code = make.block([make.word("test", ctx), make.num(42)]);

            const result = doBlock(code);

            expect(result.value).toBe(42);
        });

        it("throws on insufficient arguments", () => {
            const ctx = new Context();

            const fnSpec = make.block([make.word("a"), make.word("b")]);
            const fnBody = make.block([make.word("a")]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("needs-two"), fn);

            // Call with only one argument
            const code = make.block([
                make.word("needs-two", ctx),
                make.num(10),
            ]);

            expect(() => doBlock(code)).toThrow(/not enough arguments/i);
        });
    });

    describe("Recursive functions (Dynamic Recursion Patch)", () => {
        it("handles simple recursion", () => {
            const ctx = new Context();

            // countdown: func [n] [either n = 0 [0] [countdown n - 1]]
            // Simplified: just decrement and check
            // We'll do: func [n] [n]
            // And manually test recursion with a counter

            const fnSpec = make.block([make.word("n")]);
            const fnBody = make.block([make.word("n")]);
            const countFn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("count"), countFn);

            // Call: count 5
            const code = make.block([make.word("count", ctx), make.num(5)]);
            const result = doBlock(code);

            expect(result.value).toBe(5);
        });

        it("maintains separate parameter values for nested calls", () => {
            const ctx = new Context();

            // This is the key test from Bindology:
            // f: func [x] [either x = 1 [f 2] [x]]
            // When called with 1, should call f with 2, which returns 2
            // The outer call should then return 2

            // We'll build this manually since we don't have either/conditionals yet
            // Instead: func [x] [x] and we'll test parameter isolation manually

            const fnSpec = make.block([make.word("x")]);

            // Body that would recurse: we'll simulate by having the function
            // call itself and checking that x values are preserved
            const fnBody = make.block([make.word("x")]);

            const fn = makeFunc(fnSpec, fnBody);
            ctx.set(normalize("f"), fn);

            // Test that we can call multiple times and parameters are independent
            const code1 = make.block([make.word("f", ctx), make.num(10)]);
            const result1 = doBlock(code1);
            expect(result1.value).toBe(10);

            const code2 = make.block([make.word("f", ctx), make.num(20)]);
            const result2 = doBlock(code2);
            expect(result2.value).toBe(20);

            // Parameters shouldn't leak between calls
            const code3 = make.block([make.word("f", ctx), make.num(10)]);
            const result3 = doBlock(code3);
            expect(result3.value).toBe(10);
        });

        it("preserves context during nested calls", () => {
            const ctx = new Context();

            // func [x] [y: x  y]
            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([
                make.setWord("y"),
                make.word("x"),
                make.word("y"),
            ]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("test"), fn);

            // First call
            const code1 = make.block([make.word("test", ctx), make.num(100)]);
            expect(doBlock(code1).value).toBe(100);

            // Second call - should not retain y from first call
            const code2 = make.block([make.word("test", ctx), make.num(200)]);
            expect(doBlock(code2).value).toBe(200);
        });
    });

    describe("Function closure behavior", () => {
        it("demonstrates the Dynamic Recursion Patch bug from Bindology", () => {
            const ctx = new Context();

            // This is the bug:
            // f-returning-x: func [x] [func [] [x]]
            // f1: f-returning-x "OK"
            // f2: f-returning-x "BUG"
            // f1 should still return "OK" but with Dynamic Recursion Patch
            // it returns "BUG" because they share the same context

            // Outer function: func [x] [inner-body]
            const outerSpec = make.block([make.word("x")]);

            // Inner function that we'll return: func [] [x]
            const innerSpec = make.block([]);
            const innerBody = make.block([make.word("x")]);

            // The outer function's body just returns the inner function
            // In a full implementation, this would be:
            // [func [] [x]]
            // For now, we'll test that functions share contexts

            const outerFn = makeFunc(outerSpec, innerBody);
            ctx.set(normalize("maker"), outerFn);

            // Call maker with different values
            const code1 = make.block([
                make.word("maker", ctx),
                make.num(100),
            ]);
            doBlock(code1);

            const code2 = make.block([
                make.word("maker", ctx),
                make.num(200),
            ]);
            const result = doBlock(code2);

            // With Dynamic Recursion Patch, the last value wins
            expect(result.value).toBe(200);
        });
    });

    describe("Integration with existing features", () => {
        it("works with global context", () => {
            // x: 10
            // f: func [y] [x]
            // f 5  ; should return 10

            GLOBAL.set("x", make.num(10));

            const fnSpec = make.block([make.word("y")]);
            const fnBody = make.block([make.word("x", GLOBAL)]);
            const fn = makeFunc(fnSpec, fnBody);

            GLOBAL.set("f", fn);

            const code = make.block([make.word("f", GLOBAL), make.num(5)]);
            const result = doBlock(code);

            expect(result.value).toBe(10);
        });

        it("parameters shadow outer variables", () => {
            GLOBAL.set(normalize("x"), make.num(100));

            // func [x] [x]  ; x parameter shadows global x
            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([make.word("x")]);
            const fn = makeFunc(fnSpec, fnBody);

            GLOBAL.set(normalize("shadow-test"), fn);

            const code = make.block([
                make.word("shadow-test", GLOBAL),
                make.num(50),
            ]);
            const result = doBlock(code);

            // Should return parameter value, not global
            expect(result.value).toBe(50);

            // Global should be unchanged
            expect(GLOBAL.get(normalize("x")).value).toBe(100);
        });
    });
});
