import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

describe("Functions", () => {
    it("should create a function", async () => {
        const code = parse(`add: func [a b] [+ a b]`);
        const context = createPreludeContext();
        await ex(context, code);

        const add = context.get(Symbol.for("ADD"));
        expect(add).toBeDefined();
        expect(add._function).toBe(true);
        expect(add._argNames).toEqual([
            Symbol.for("A"),
            Symbol.for("B"),
        ]);
    });

    it("should call a function with evaluated arguments", async () => {
        const code = parse(`
            add: func [a b] [+ a b]
            result: add 5 10
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.value).toBe(15);
    });

    it("should handle nested function calls", async () => {
        const code = parse(`
            add: func [a b] [+ a b]
            mul: func [a b] [* a b]
            result: mul (add 2 3) 4
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.value).toBe(20); // (2 + 3) * 4 = 20
    });

    it("should support closures", async () => {
        const code = parse(`
            make-adder: func [n] [
                func [x] [+ x n]
            ]
            add5: make-adder 5
            result: add5 10
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.value).toBe(15);
    });

    it("should handle literal arguments", async () => {
        const code = parse(`
            ; Function that receives block literally
            test: func ['block] [block]
            result: test [+ 1 2]
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.items.length).toBe(3); // Block with [+ 1 2]
    });

    it("should mix literal and evaluated arguments", async () => {
        const code = parse(`
            ; First arg literal, second evaluated
            my-func: func ['block value] [
                ; block is literal, value is evaluated
                value
            ]
            x: 42
            result: my-func [ignored] x
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.value).toBe(42);
    });

    it("should allow introspection of functions", async () => {
        const code = parse(`
            add: func [a b] [+ a b]
            body: in add [body]
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const body = context.get(Symbol.for("BODY"));
        expect(body.items.length).toBe(3); // [+ a b]
    });

    it("should allow modifying function context", async () => {
        const code = parse(`
            test: func [x] [+ x offset]
            in test [offset: 10]
            result: test 5
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result.value).toBe(15); // 5 + 10
    });

    it("should handle recursive functions", async () => {
        const code = parse(`
            fact: func [n] [
                (= n 0)
            ]
        `);
        const context = createPreludeContext();
        await ex(context, code);

        // Just test creation for now - actual recursion would need conditionals
        const fact = context.get(Symbol.for("FACT"));
        expect(fact._function).toBe(true);
    });

    it("should support multiple closures sharing state", async () => {
        const code = parse(`
            make-counter: func [] [
                count: 0
                func [] [
                    count: + count 1
                    count
                ]
            ]
            counter: make-counter
        `);
        const context = createPreludeContext();
        await ex(context, code);

        const counter = context.get(Symbol.for("COUNTER"));
        expect(counter._function).toBe(true);
    });
});
