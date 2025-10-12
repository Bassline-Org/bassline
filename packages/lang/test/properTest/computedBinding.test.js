// computed-binding.test.js
import { describe, expect, it } from "vitest";
import { doBlock } from "../../src/proper/evaluate.js";
import { Context } from "../../src/proper/context.js";
import { make } from "../../src/proper/cells.js";
import { bind } from "../../src/proper/bind.js";
import { use } from "../../src/proper/evaluate.js";

describe("computed binding", () => {
    it("demonstrates nested USE calls rebinding words", () => {
        // From bindology: use [g h] [... use [h] [...]]
        // We'll track which context each word is bound to
        const globalCtx = new Context();
        globalCtx.set("f", make.num(1));
        globalCtx.set("g", make.num(2));
        globalCtx.set("h", make.num(3));

        // Inner USE body: [h: 300]
        const innerBody = make.block([
            make.setWord("h"), // Will be bound by inner USE
            make.num(300),
        ]);

        // Outer USE body: [g: 20 h: 30 use [h] innerBody]
        const outerBody = make.block([
            make.setWord("g"), // Will be bound by outer USE
            make.num(20),
            make.setWord("h"), // Will be bound by outer USE
            make.num(30),
            // Then we'd call use([h], innerBody) here
        ]);

        // First bind outer body to global
        bind(outerBody, globalCtx);

        // Execute outer USE
        use(["g", "h"], outerBody);

        // After outer USE, g and h in outerBody should be bound to outer context
        const gWord = outerBody.buffer.data[0];
        const hWord = outerBody.buffer.data[2];

        expect(gWord.binding).not.toBe(globalCtx);
        expect(hWord.binding).not.toBe(globalCtx);
        expect(gWord.binding).toBe(hWord.binding); // Same outer context

        // Now execute inner USE
        use(["h"], innerBody);

        // After inner USE, h in innerBody should be bound to inner context
        const innerH = innerBody.buffer.data[0];
        expect(innerH.binding).not.toBe(globalCtx);
        expect(innerH.binding).not.toBe(hWord.binding); // Different from outer
    });

    it("demonstrates that binding persists after USE", () => {
        // Create a block with unbound words
        const body = make.block([
            make.setWord("x"),
            make.num(42),
            make.word("x"),
        ]);

        // Check initial state - unbound
        expect(body.buffer.data[0].binding).toBeUndefined();
        expect(body.buffer.data[2].binding).toBeUndefined();

        // Execute USE
        const result = use(["x"], body);
        expect(result.value).toBe(42);

        // After USE, the words in the buffer are now bound
        expect(body.buffer.data[0].binding).toBeDefined();
        expect(body.buffer.data[2].binding).toBeDefined();

        // And they're bound to the same context
        expect(body.buffer.data[0].binding).toBe(body.buffer.data[2].binding);

        // If we call doBlock again, it uses the same bindings
        const result2 = doBlock(body);
        expect(result2.value).toBe(42);
    });
});
