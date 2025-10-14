import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

describe("Context Manipulation", () => {
    it("should create a new context", () => {
        const code = parse(`ctx: context`);
        const prelude = createPreludeContext();
        ex(prelude, code);

        const ctx = prelude.get(Symbol.for("CTX"));
        expect(ctx).toBeDefined();
        expect(ctx.bindings).toBeDefined();
    });

    it("should set values in a context using 'in'", () => {
        const code = parse(`
            ctx: context
            in ctx [x: 5 y: 10]
        `);
        const prelude = createPreludeContext();
        ex(prelude, code);

        const ctx = prelude.get(Symbol.for("CTX"));
        expect(ctx.get(Symbol.for("X")).value).toBe(5);
        expect(ctx.get(Symbol.for("Y")).value).toBe(10);
    });

    it("should get values from a context using 'in'", () => {
        const code = parse(`
            ctx: context
            in ctx [x: 42]
            result: in ctx [x]
        `);
        const prelude = createPreludeContext();
        ex(prelude, code);

        const result = prelude.get(Symbol.for("RESULT"));
        expect(result.value).toBe(42);
    });

    it("should support lexical scope via parent chain", () => {
        const code = parse(`
            x: 10
            ctx: context
            in ctx [y: + x 5]
            result: in ctx [y]
        `);
        const prelude = createPreludeContext();
        ex(prelude, code);

        const result = prelude.get(Symbol.for("RESULT"));
        expect(result.value).toBe(15); // ctx can see x from parent (prelude)
    });

    it("should allow nested contexts", () => {
        const code = parse(`
            x: 1
            ctx1: context
            in ctx1 [
                y: 2
                ctx2: context
                in ctx2 [z: + x y]
            ]
            result: in ctx1 [in ctx2 [z]]
        `);
        const prelude = createPreludeContext();
        ex(prelude, code);

        const ctx1 = prelude.get(Symbol.for("CTX1"));
        const ctx2 = ctx1.get(Symbol.for("CTX2"));
        expect(ctx2.get(Symbol.for("Z")).value).toBe(3); // 1 + 2
    });
});
