// test/natives.test.js
import { beforeAll, describe, expect, it } from "vitest";
import { make } from "../src/cells/index.js";
import { Context, GLOBAL } from "../src/context.js";
import { doBlock } from "../src/evaluator.js";
import { normalize } from "../src/spelling.js";
import { setupNatives } from "../src/cells/natives.js";
import { makeFunc } from "../src/cells/functions.js";

describe("Native Functions", () => {
    beforeAll(() => {
        setupNatives();
    });

    describe("Arithmetic", () => {
        it("adds two numbers", () => {
            // 2 + 3
            const code = make.block([
                make.word("+", GLOBAL),
                make.num(2),
                make.num(3),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(5);
        });

        it("subtracts numbers", () => {
            // 10 - 3
            const code = make.block([
                make.word("-", GLOBAL),
                make.num(10),
                make.num(3),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(7);
        });

        it("multiplies numbers", () => {
            // 4 * 5
            const code = make.block([
                make.word("*", GLOBAL),
                make.num(4),
                make.num(5),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(20);
        });

        it("divides numbers", () => {
            // 20 / 4
            const code = make.block([
                make.word("/", GLOBAL),
                make.num(20),
                make.num(4),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(5);
        });

        it("throws on division by zero", () => {
            const code = make.block([
                make.word("/", GLOBAL),
                make.num(10),
                make.num(0),
            ]);

            expect(() => doBlock(code)).toThrow(/division by zero/);
        });

        it("computes modulo", () => {
            // 10 mod 3
            const code = make.block([
                make.word("mod", GLOBAL),
                make.num(10),
                make.num(3),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(1);
        });

        it("chains arithmetic operations", () => {
            // (2 + 3) * 4 = 20
            const code = make.block([
                make.word("*", GLOBAL),
                make.paren([
                    make.word("+", GLOBAL),
                    make.num(2),
                    make.num(3),
                ]),
                make.num(4),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(20);
        });
    });

    describe("Comparison", () => {
        it("equals (=) compares numbers", () => {
            // 5 = 5
            const code1 = make.block([
                make.word("=", GLOBAL),
                make.num(5),
                make.num(5),
            ]);
            expect(doBlock(code1).value).toBe(1);

            // 5 = 3
            const code2 = make.block([
                make.word("=", GLOBAL),
                make.num(5),
                make.num(3),
            ]);
            expect(doBlock(code2).value).toBe(0);
        });

        it("less than (<)", () => {
            // 3 < 5
            const code1 = make.block([
                make.word("<", GLOBAL),
                make.num(3),
                make.num(5),
            ]);
            expect(doBlock(code1).value).toBe(1);

            // 5 < 3
            const code2 = make.block([
                make.word("<", GLOBAL),
                make.num(5),
                make.num(3),
            ]);
            expect(doBlock(code2).value).toBe(0);
        });

        it("greater than (>)", () => {
            // 5 > 3
            const code = make.block([
                make.word(">", GLOBAL),
                make.num(5),
                make.num(3),
            ]);
            expect(doBlock(code).value).toBe(1);
        });

        it("less than or equal (<=)", () => {
            const code1 = make.block([
                make.word("<=", GLOBAL),
                make.num(3),
                make.num(5),
            ]);
            expect(doBlock(code1).value).toBe(1);

            const code2 = make.block([
                make.word("<=", GLOBAL),
                make.num(5),
                make.num(5),
            ]);
            expect(doBlock(code2).value).toBe(1);
        });

        it("greater than or equal (>=)", () => {
            const code = make.block([
                make.word(">=", GLOBAL),
                make.num(5),
                make.num(3),
            ]);
            expect(doBlock(code).value).toBe(1);
        });
    });

    describe("Logic", () => {
        it("AND with short-circuit", () => {
            // 1 and 1
            const code1 = make.block([
                make.word("and", GLOBAL),
                make.num(1),
                make.num(1),
            ]);
            expect(doBlock(code1).value).toBe(1);

            // 0 and 1
            const code2 = make.block([
                make.word("and", GLOBAL),
                make.num(0),
                make.num(1),
            ]);
            expect(doBlock(code2).value).toBe(0);
        });

        it("OR with short-circuit", () => {
            // 1 or 0
            const code1 = make.block([
                make.word("or", GLOBAL),
                make.num(1),
                make.num(0),
            ]);
            expect(doBlock(code1).value).toBe(1);

            // 0 or 1
            const code2 = make.block([
                make.word("or", GLOBAL),
                make.num(0),
                make.num(1),
            ]);
            expect(doBlock(code2).value).toBe(1);
        });

        it("NOT negates values", () => {
            const code1 = make.block([
                make.word("not", GLOBAL),
                make.num(1),
            ]);
            expect(doBlock(code1).value).toBe(0);

            const code2 = make.block([
                make.word("not", GLOBAL),
                make.num(0),
            ]);
            expect(doBlock(code2).value).toBe(1);
        });
    });

    describe("Control Flow", () => {
        it("IF executes body when condition is true", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(0));

            // if 1 [x: 42]
            const code = make.block([
                make.word("if", GLOBAL),
                make.num(1),
                make.block([
                    make.setWord("x", ctx),
                    make.num(42),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("x")).value).toBe(42);
        });

        it("IF doesn't execute body when condition is false", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(0));

            // if 0 [x: 42]
            const code = make.block([
                make.word("if", GLOBAL),
                make.num(0),
                make.block([
                    make.setWord("x", ctx),
                    make.num(42),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("x")).value).toBe(0);
        });

        it("EITHER executes true branch", () => {
            // either 1 [10] [20]
            const code = make.block([
                make.word("either", GLOBAL),
                make.num(1),
                make.block([make.num(10)]),
                make.block([make.num(20)]),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(10);
        });

        it("EITHER executes false branch", () => {
            // either 0 [10] [20]
            const code = make.block([
                make.word("either", GLOBAL),
                make.num(0),
                make.block([make.num(10)]),
                make.block([make.num(20)]),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(20);
        });

        it("WHILE loops until condition is false", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(0));

            // while [< x 5] [x: + x 1]
            const code = make.block([
                make.word("while", GLOBAL),
                make.block([
                    make.word("<", GLOBAL),
                    make.word("x", ctx),
                    make.num(5),
                ]),
                make.block([
                    make.setWord("x", ctx),
                    make.word("+", GLOBAL),
                    make.word("x", ctx),
                    make.num(1),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("x")).value).toBe(5);
        });

        it("LOOP repeats N times", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(0));

            // loop 3 [x: + x 1]
            const code = make.block([
                make.word("loop", GLOBAL),
                make.num(3),
                make.block([
                    make.setWord("x", ctx),
                    make.word("+", GLOBAL),
                    make.word("x", ctx),
                    make.num(1),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("x")).value).toBe(3);
        });
    });

    describe("Series Operations", () => {
        it("FIRST gets first element", () => {
            const blk = make.block([make.num(1), make.num(2), make.num(3)]);
            const ctx = new Context();
            ctx.set(normalize("blk"), blk);

            // first blk
            const code = make.block([
                make.word("first", GLOBAL),
                make.word("blk", ctx),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(1);
        });

        it("NEXT moves to next position", () => {
            const blk = make.block([make.num(1), make.num(2), make.num(3)]);
            const ctx = new Context();
            ctx.set(normalize("blk"), blk);

            // first next blk
            const code = make.block([
                make.word("first", GLOBAL),
                make.word("next", GLOBAL),
                make.word("blk", ctx),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(2);
        });

        it("HEAD returns to start", () => {
            const blk = make.block([make.num(1), make.num(2), make.num(3)]);
            const next = blk.next();
            const ctx = new Context();
            ctx.set(normalize("blk"), next);

            // head blk
            const code = make.block([
                make.word("head", GLOBAL),
                make.word("blk", ctx),
            ]);

            const result = doBlock(code);
            expect(result.index).toBe(0);
        });

        it("TAIL? checks if at end", () => {
            const blk = make.block([make.num(1)]);
            const tail = blk.tail();
            const ctx = new Context();
            ctx.set(normalize("blk"), tail);

            // tail? blk
            const code = make.block([
                make.word("tail?", GLOBAL),
                make.word("blk", ctx),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(1);
        });

        it("LENGTH? returns length", () => {
            const blk = make.block([make.num(1), make.num(2), make.num(3)]);
            const ctx = new Context();
            ctx.set(normalize("blk"), blk);

            // length? blk
            const code = make.block([
                make.word("length?", GLOBAL),
                make.word("blk", ctx),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(3);
        });

        it("APPEND adds element", () => {
            const blk = make.block([make.num(1), make.num(2)]);
            const ctx = new Context();
            ctx.set(normalize("blk"), blk);

            // append blk 3
            const code = make.block([
                make.word("append", GLOBAL),
                make.word("blk", ctx),
                make.num(3),
            ]);

            doBlock(code);
            expect(blk.buffer.length).toBe(3);
            expect(blk.buffer.data[2].value).toBe(3);
        });
    });

    describe("Type Predicates", () => {
        it("NUMBER? checks for numbers", () => {
            const code1 = make.block([
                make.word("number?", GLOBAL),
                make.num(42),
            ]);
            expect(doBlock(code1).value).toBe(1);

            const code2 = make.block([
                make.word("number?", GLOBAL),
                make.block([]),
            ]);
            expect(doBlock(code2).value).toBe(0);
        });

        it("BLOCK? checks for blocks", () => {
            const code = make.block([
                make.word("block?", GLOBAL),
                make.block([make.num(1)]),
            ]);
            expect(doBlock(code).value).toBe(1);
        });

        it("NONE? checks for none", () => {
            const code = make.block([
                make.word("none?", GLOBAL),
                make.none(),
            ]);
            expect(doBlock(code).value).toBe(1);
        });

        it("FUNCTION? checks for functions", () => {
            const fn = makeFunc(
                make.block([make.word("x")]),
                make.block([make.word("x")]),
            );

            const ctx = new Context();
            ctx.set(normalize("f"), fn);

            const code = make.block([
                make.word("function?", GLOBAL),
                make.getWord("f", ctx),  // Use GET-WORD to pass function value without applying
            ]);

            expect(doBlock(code).value).toBe(1);
        });
    });

    describe("Utility", () => {
        it("QUOTE returns unevaluated argument", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(42));

            // quote x  (returns the word 'x', not 42)
            const code = make.block([
                make.word("quote", GLOBAL),
                make.word("x", ctx),
            ]);

            const result = doBlock(code);
            expect(result.typeName).toBe("word");
            expect(result.spelling).toBe(normalize("x"));
        });

        it("DO evaluates a block", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(0));

            // do [x: 42]
            const code = make.block([
                make.word("do", GLOBAL),
                make.block([
                    make.setWord("x", ctx),
                    make.num(42),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("x")).value).toBe(42);
        });

        it("PROBE returns its argument", () => {
            const code = make.block([
                make.word("probe", GLOBAL),
                make.num(42),
            ]);

            const result = doBlock(code);
            expect(result.value).toBe(42);
        });
    });

    describe("Complex Examples", () => {
        it("factorial with recursion", () => {
            // factorial: func [n] [
            //     either <= n 1 [1] [* n factorial - n 1]
            // ]
            const ctx = new Context();

            const fnSpec = make.block([make.word("n")]);
            const fnBody = make.block([
                make.word("either", GLOBAL),
                make.word("<=", GLOBAL),
                make.word("n"),
                make.num(1),
                make.block([make.num(1)]),
                make.block([
                    make.word("*", GLOBAL),
                    make.word("n"),
                    make.word("factorial", ctx),
                    make.word("-", GLOBAL),
                    make.word("n"),
                    make.num(1),
                ]),
            ]);

            const factorial = makeFunc(fnSpec, fnBody);
            ctx.set(normalize("factorial"), factorial);

            // factorial 5
            const code = make.block([
                make.word("factorial", ctx),
                make.num(5),
            ]);

            const result = doBlock(code);
            console.log("result", result);
            expect(result.value).toBe(120);
        });

        it("sum of list with while loop", () => {
            const ctx = new Context();
            const blk = make.block([
                make.num(1),
                make.num(2),
                make.num(3),
                make.num(4),
                make.num(5),
            ]);

            ctx.set(normalize("nums"), blk);
            ctx.set(normalize("total"), make.num(0));
            ctx.set(normalize("pos"), blk);

            // while [not tail? pos] [
            //     total: + total first pos
            //     pos: next pos
            // ]
            const code = make.block([
                make.word("while", GLOBAL),
                make.block([
                    make.word("not", GLOBAL),
                    make.word("tail?", GLOBAL),
                    make.word("pos", ctx),
                ]),
                make.block([
                    make.setWord("total", ctx),
                    make.word("+", GLOBAL),
                    make.word("total", ctx),
                    make.word("first", GLOBAL),
                    make.word("pos", ctx),
                    make.setWord("pos", ctx),
                    make.word("next", GLOBAL),
                    make.word("pos", ctx),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("total")).value).toBe(15);
        });

        it("nested IF with comparison", () => {
            const ctx = new Context();
            ctx.set(normalize("x"), make.num(10));
            ctx.set(normalize("result"), make.num(0));

            // if > x 5 [
            //     if < x 15 [
            //         result: 42
            //     ]
            // ]
            const code = make.block([
                make.word("if", GLOBAL),
                make.word(">", GLOBAL),
                make.word("x", ctx),
                make.num(5),
                make.block([
                    make.word("if", GLOBAL),
                    make.word("<", GLOBAL),
                    make.word("x", ctx),
                    make.num(15),
                    make.block([
                        make.setWord("result", ctx),
                        make.num(42),
                    ]),
                ]),
            ]);

            doBlock(code);
            expect(ctx.get(normalize("result")).value).toBe(42);
        });
    });
});
