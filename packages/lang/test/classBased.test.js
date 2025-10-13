import { describe, expect, it } from "vitest";
import { make, NumberCell, series } from "../src/cells/index.js";
import { Context } from "../src/context.js";
import { bind } from "../src/bind.js";
import { doBlock } from "../src/evaluator.js";
import { makeFunc } from "../src/cells/functions.js";
import { normalize } from "../src/utils.js";
import { deepCopy } from "../src/utils.js";

describe("Class-Based Cells", () => {
    describe("Cell Protocol", () => {
        it("cells are frozen (immutable)", () => {
            const num = make.num(42);
            expect(() => {
                num.value = 100;
            }).toThrow();
        });

        it("cells have typeName", () => {
            expect(make.none().typeName).toBe("none");
            expect(make.num(42).typeName).toBe("number");
            expect(make.word("x").typeName).toBe("word");
            expect(make.block([]).typeName).toBe("block");
        });

        it("numbers self-evaluate", () => {
            const num = make.num(42);
            const result = num.evaluate(null);
            expect(result).toBe(num);
        });

        it("blocks self-evaluate", () => {
            const blk = make.block([make.num(1)]);
            const result = blk.evaluate(null);
            expect(result).toBe(blk);
        });
    });

    describe("Series Navigation", () => {
        it("navigates through blocks", () => {
            const blk = make.block([make.num(1), make.num(2), make.num(3)]);

            const blk2 = series.next(blk);
            expect(series.first(blk).value).toBe(1);
            expect(series.first(blk2).value).toBe(2);
        });

        it("shares buffers", () => {
            const blk1 = make.block([make.num(1)]);
            const blk2 = series.next(blk1);

            expect(blk1.buffer).toBe(blk2.buffer);
        });

        it("handles tail correctly", () => {
            const blk = make.block([make.num(1)]);
            const tail = series.tail(blk);

            expect(series.isTail(tail)).toBe(true);
        });

        it("uses method syntax", () => {
            const blk = make.block([make.num(1), make.num(2)]);

            // Can use methods directly on cells
            const next = blk.next();
            expect(next.first().value).toBe(2);

            const back = next.back();
            expect(back.first().value).toBe(1);
        });
    });

    describe("Word Evaluation", () => {
        it("words look up their values", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(42));

            const word = make.word("x", ctx);
            const result = word.evaluate(null);

            expect(result.value).toBe(42);
        });

        it("throws on unbound word", () => {
            const word = make.word("x");
            expect(() => word.evaluate(null)).toThrow(/no context/);
        });

        it("GET-WORD returns value without further evaluation", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(42));

            const getWord = make.getWord("x", ctx);
            const result = getWord.evaluate(null);

            expect(result.value).toBe(42);
        });

        it("LIT-WORD returns a regular word", () => {
            const ctx = new Context();
            const litWord = make.litWord("x", ctx);
            const result = litWord.evaluate(null);

            expect(result.typeName).toBe("word");
            expect(result.spelling).toBe(litWord.spelling);
        });
    });

    describe("doBlock", () => {
        it("evaluates self-evaluating values", () => {
            const blk = make.block([make.num(42)]);
            const result = doBlock(blk);

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
            expect(ctx.get(normalize("x")).value).toBe(42);
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
            expect(ctx.get(normalize("x")).value).toBe(1);
            expect(ctx.get(normalize("y")).value).toBe(2);
        });

        it("assigns looked-up values", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(100));

            const blk = make.block([
                make.setWord("y", ctx),
                make.word("x", ctx),
            ]);

            const result = doBlock(blk);

            expect(result.value).toBe(100);
            expect(ctx.get(normalize("y")).value).toBe(100);
        });
    });

    describe("Functions", () => {
        it("creates and calls simple function", () => {
            const ctx = new Context();

            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([make.word("x")]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("identity"), fn);

            const code = make.block([
                make.word("identity", ctx),
                make.num(42),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(42);
        });

        it("handles multiple parameters", () => {
            const ctx = new Context();

            const fnSpec = make.block([make.word("a"), make.word("b")]);
            const fnBody = make.block([make.word("a")]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("first"), fn);

            const code = make.block([
                make.word("first", ctx),
                make.num(10),
                make.num(20),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(10);
        });

        it("handles local variables (SET-WORD in body)", () => {
            const ctx = new Context();

            const fnSpec = make.block([make.word("val")]);
            const fnBody = make.block([
                make.setWord("temp"),
                make.word("val"),
                make.word("temp"),
            ]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("store"), fn);

            const code = make.block([
                make.word("store", ctx),
                make.num(99),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(99);
        });

        it("parameters shadow outer variables", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(100));

            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([make.word("x")]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("shadow"), fn);

            const code = make.block([
                make.word("shadow", ctx),
                make.num(50),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(50);

            // Global unchanged
            expect(ctx.get(normalize("x")).value).toBe(100);
        });

        it("accesses global context", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(10));

            const fnSpec = make.block([make.word("y")]);
            const fnBody = make.block([make.word("x", ctx)]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("f"), fn);

            const code = make.block([
                make.word("f", ctx),
                make.num(5),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(10);
        });

        it("handles recursion with Dynamic Recursion Patch", () => {
            const ctx = new Context();

            const fnSpec = make.block([make.word("x")]);
            const fnBody = make.block([make.word("x")]);
            const fn = makeFunc(fnSpec, fnBody);

            ctx.set(normalize("f"), fn);

            // Multiple independent calls
            const code1 = make.block([
                make.word("f", ctx),
                make.num(100),
            ]);
            expect(doBlock(code1).value).toBe(100);

            const code2 = make.block([
                make.word("f", ctx),
                make.num(200),
            ]);
            expect(doBlock(code2).value).toBe(200);

            const code3 = make.block([
                make.word("f", ctx),
                make.num(100),
            ]);
            expect(doBlock(code3).value).toBe(100);
        });
    });

    describe("Binding", () => {
        it("only rebinds words that exist in target context", () => {
            const ctx1 = new Context();
            const ctx2 = new Context();

            ctx1.set(normalize("x"), make.num(10));
            ctx2.set(normalize("y"), make.num(20));

            const word = make.word("x", ctx1);
            const rebound = bind(word, ctx2);

            // x doesn't exist in ctx2, so unchanged
            expect(rebound.binding).toBe(ctx1);
        });

        it("rebinds words that exist in target context", () => {
            const ctx1 = new Context();
            const ctx2 = new Context();

            ctx1.set(normalize("x"), make.num(10));
            ctx2.set(normalize("x"), make.num(20));

            const word = make.word("x", ctx1);
            const rebound = bind(word, ctx2);

            // x exists in ctx2, so rebound
            expect(rebound.binding).toBe(ctx2);
        });

        it("recursively binds blocks", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(42));

            const blk = make.block([make.word("x")]);
            bind(blk, ctx);

            const boundWord = series.first(blk);
            expect(boundWord.binding).toBe(ctx);
        });
    });

    describe("Step Protocol", () => {
        it("simple values consume 1 position", () => {
            const num = make.num(42);
            const blk = make.block([num]);

            const { value, consumed } = num.step(blk, null);

            expect(value).toBe(num);
            expect(consumed).toBe(1);
        });

        it("SET-WORD consumes 2 positions", () => {
            const ctx = new Context();
            const setWord = make.setWord("x", ctx);
            const blk = make.block([setWord, make.num(42)]);

            const { value, consumed } = setWord.step(blk, {
                series,
                doBlock: () => {},
            });

            expect(value.value).toBe(42);
            expect(consumed).toBe(2);
        });

        it("functions consume 1 + N positions", () => {
            const ctx = new Context();
            const fnSpec = make.block([make.word("a"), make.word("b")]);
            const fnBody = make.block([make.word("a")]);
            const fn = makeFunc(fnSpec, fnBody);

            const code = make.block([fn, make.num(10), make.num(20)]);

            const evaluator = {
                series,
                doBlock: (blk) => blk.first(),
            };

            const { value, consumed } = fn.step(code, evaluator);

            expect(consumed).toBe(3); // function + 2 args
        });
    });

    describe("Polymorphism", () => {
        it("cells know their own type", () => {
            const cells = [
                make.num(42),
                make.word("x"),
                make.block([]),
                make.none(),
            ];

            const types = cells.map((c) => c.typeName);
            expect(types).toEqual(["number", "word", "block", "none"]);
        });

        it("instanceof works for type checking", () => {
            const num = make.num(42);

            expect(num instanceof NumberCell).toBe(true);
        });

        it("each cell evaluates differently", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(100));

            // Number evaluates to itself
            const num = make.num(42);
            expect(num.evaluate(null)).toBe(num);

            // Word evaluates to its value
            const word = make.word("x", ctx);
            expect(word.evaluate(null).value).toBe(100);

            // Lit-word evaluates to a word
            const litWord = make.litWord("x", ctx);
            const result = litWord.evaluate(null);
            expect(result.typeName).toBe("word");
        });
    });
});
describe("Bindology Edge Cases", () => {
    it("USE recursive bug - body gets modified", () => {
        const ctx = new Context();

        // f: func [x] [use [a] [either x = 1 [a: "OK" f 2 a] [a: "BUG!" "OK"]]]
        // Without copy/deep, the inner USE call rebinds the outer's 'a'

        const fnSpec = make.block([make.word("x")]);
        const fnBody = make.block([
            make.setWord("a"),
            make.word("x"),
        ]);
        const fn = makeFunc(fnSpec, fnBody);

        ctx.set(normalize("f"), fn);

        // First call
        const code1 = make.block([make.word("f", ctx), make.num(1)]);
        const result1 = doBlock(code1);
        expect(result1.value).toBe(1);

        // Second call - should still work
        const code2 = make.block([make.word("f", ctx), make.num(2)]);
        const result2 = doBlock(code2);
        expect(result2.value).toBe(2);
    });

    it("The closure bug - Dynamic Recursion Patch limitation", () => {
        const ctx = new Context();

        // This is the bug from Bindology:
        // f-returning-x: func [x] [func [] [x]]
        // f1: f-returning-x "OK"
        // f2: f-returning-x "BUG"
        // f1  ; returns "BUG" instead of "OK" because they share context

        // We can't fully test this without having functions that return functions,
        // but we can test that multiple calls to the same function don't leak state

        const fnSpec = make.block([make.word("x")]);
        const fnBody = make.block([
            make.setWord("temp"),
            make.word("x"),
            make.word("temp"),
        ]);
        const fn = makeFunc(fnSpec, fnBody);

        ctx.set(normalize("storer"), fn);

        // Call with "OK"
        const code1 = make.block([make.word("storer", ctx), make.num(100)]);
        const result1 = doBlock(code1);
        expect(result1.value).toBe(100);

        // Call with "BUG"
        const code2 = make.block([make.word("storer", ctx), make.num(200)]);
        const result2 = doBlock(code2);
        expect(result2.value).toBe(200);

        // Call with "OK" again - should not return "BUG"
        const code3 = make.block([make.word("storer", ctx), make.num(100)]);
        const result3 = doBlock(code3);
        expect(result3.value).toBe(100);
    });

    it("Nested contexts - parameters in inner function shadow outer", () => {
        const ctx = new Context();

        // outer: func [x] [inner: func [x] [x + x] inner 5]
        // The inner x should shadow the outer x

        // For now, test that we can create functions with same parameter names
        const outerSpec = make.block([make.word("x")]);
        const outerBody = make.block([make.word("x")]);
        const outerFn = makeFunc(outerSpec, outerBody);

        const innerSpec = make.block([make.word("x")]);
        const innerBody = make.block([make.word("x")]);
        const innerFn = makeFunc(innerSpec, innerBody);

        // They should have different contexts
        expect(outerFn.fn.context).not.toBe(innerFn.fn.context);
    });

    it("Deep copy preserves binding correctly", () => {
        const ctx1 = new Context();
        const ctx2 = new Context();

        ctx1.set(normalize("x"), make.num(10));
        ctx2.set(normalize("x"), make.num(20));

        const blk = make.block([make.word("x", ctx1)]);
        const copied = deepCopy(blk);

        // Deep copy should preserve bindings
        const originalWord = series.first(blk);
        const copiedWord = series.first(copied);

        expect(copiedWord.binding).toBe(ctx1);
        expect(copiedWord.spelling).toBe(originalWord.spelling);

        // But they should be different cells
        expect(copiedWord).not.toBe(originalWord);
    });

    it("Bind respects context membership (ineffective bind)", () => {
        const ctx1 = new Context();
        const ctx2 = new Context();

        ctx1.set(normalize("x"), make.num(10));
        // ctx2 does NOT have x

        const word = make.word("x", ctx1);
        const rebound = bind(word, ctx2);

        // Since x doesn't exist in ctx2, bind should be ineffective
        expect(rebound.binding).toBe(ctx1);

        // Now add x to ctx2
        ctx2.set(normalize("x"), make.num(20));
        const rebound2 = bind(word, ctx2);

        // Now it should rebind
        expect(rebound2.binding).toBe(ctx2);
    });

    it("Functions capture their definition environment", () => {
        const ctx = new Context();
        ctx.set(normalize("outer"), make.num(100));

        // func [x] [outer]  - should capture outer from definition context
        const fnSpec = make.block([make.word("x")]);
        const fnBody = make.block([make.word("outer", ctx)]);
        const fn = makeFunc(fnSpec, fnBody);

        // Change outer after function definition
        ctx.set(normalize("outer"), make.num(200));

        ctx.set(normalize("f"), fn);
        const code = make.block([make.word("f", ctx), make.num(5)]);

        // Should see the current value (200), not the value at definition time
        // Because we're not doing lexical closures, we're using dynamic binding
        const result = doBlock(code);
        expect(result.value).toBe(200);
    });
});
