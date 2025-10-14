import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";
import { ex, createPreludeContext } from "../src/prelude.js";

describe("Mold - Serialization", () => {
    it("should mold numbers", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold 42"));
        expect(result.value).toBe("42");
    });

    it("should mold strings", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse('mold "hello"'));
        expect(result.value).toBe('"hello"');
    });

    it("should mold strings with quotes", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse('mold "say \\"hi\\""'));
        expect(result.value).toBe('"say \\"hi\\""');
    });

    it("should mold unevaluated words from blocks", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold [x]"));
        expect(result.value).toBe("[X]");
    });

    it("should mold unevaluated set words from blocks", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold [x:]"));
        expect(result.value).toBe("[X:]");
    });

    it("should mold unevaluated lit words from blocks", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold ['x]"));
        expect(result.value).toBe("['X]");
    });

    it("should mold blocks", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold [1 2 3]"));
        expect(result.value).toBe("[1 2 3]");
    });

    it("should mold nested blocks", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold [x: [1 2] y: [3 4]]"));
        expect(result.value).toBe("[X: [1 2] Y: [3 4]]");
    });

    it("should mold result of paren evaluation", async () => {
        const ctx = createPreludeContext();
        // Parens evaluate, so mold gets the result (3)
        const result = await ex(ctx, parse("mold (+ 1 2)"));
        expect(result.value).toBe("3");
    });

    it("should mold unevaluated paren from block", async () => {
        const ctx = createPreludeContext();
        // Inside a block, parens don't evaluate
        const result = await ex(ctx, parse("mold [(+ 1 2)]"));
        expect(result.value).toBe("[(+ 1 2)]");
    });

    it("should mold empty context", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("myctx: context"));
        const result = await ex(ctx, parse("mold myctx"));
        expect(result.value).toBe("context");
    });

    it("should mold context with bindings", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("myctx: context"));
        await ex(ctx, parse("in myctx [x: 5 y: 10]"));
        const result = await ex(ctx, parse("mold myctx"));
        // Should produce valid context reconstruction code
        expect(result.value).toBe("in (context) [X: 5 Y: 10]");
    });

    it("should mold function word in block", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("add: func [a b] [+ a b]"));
        const result = await ex(ctx, parse("mold [add]"));
        // Inside block, add is unevaluated Word
        expect(result.value).toBe("[ADD]");
    });

    it("should handle JS primitives", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("x: + 1 2")); // Evaluates to Num
        const result = await ex(ctx, parse("mold x"));
        expect(result.value).toBe("3");
    });

    it("should handle booleans", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("x: true"));
        const result = await ex(ctx, parse("mold x"));
        expect(result.value).toBe("true");

        await ex(ctx, parse("y: false"));
        const result2 = await ex(ctx, parse("mold y"));
        expect(result2.value).toBe("false");
    });

    it("should handle none", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("x: none"));
        const result = await ex(ctx, parse("mold x"));
        expect(result.value).toBe("none");
    });

    it("should mold native word in block", async () => {
        const ctx = createPreludeContext();
        const result = await ex(ctx, parse("mold [+]"));
        expect(result.value).toBe("[+]");
    });
});

describe("Mold - Round-trip", () => {
    it("should round-trip numbers", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("x: 42"));
        const molded = await ex(ctx, parse("mold x"));
        const parsed = parse(molded.value);
        const result = await ex(ctx, parsed);
        expect(result.value).toBe(42);
    });

    it("should round-trip strings", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse('x: "hello world"'));
        const molded = await ex(ctx, parse("mold x"));
        const parsed = parse(molded.value);
        const result = await ex(ctx, parsed);
        expect(result.value).toBe("hello world");
    });

    it("should round-trip blocks", async () => {
        const ctx = createPreludeContext();
        const molded = await ex(ctx, parse("mold [1 2 3]"));
        // molded.value is "[1 2 3]" - parse this string
        const parsed = parse(molded.value);
        // Parsed is a Block wrapping a Str "[1 2 3]", we need the first item which is a Block
        const block = parsed.items[0];
        expect(block.items.length).toBe(3);
        expect(block.items[0].value).toBe(1);
        expect(block.items[1].value).toBe(2);
        expect(block.items[2].value).toBe(3);
    });

    it("should round-trip contexts", async () => {
        const ctx = createPreludeContext();
        await ex(ctx, parse("original: context"));
        await ex(ctx, parse("in original [x: 5 y: 10]"));
        const molded = await ex(ctx, parse("mold original"));

        // Molded should be "in (context) [X: 5 Y: 10]"
        expect(molded.value).toBe("in (context) [X: 5 Y: 10]");

        // Create another context the same way and verify mold produces same output
        await ex(ctx, parse("copy: context"));
        await ex(ctx, parse("in copy [x: 5 y: 10]"));
        const copyMolded = await ex(ctx, parse("mold copy"));

        expect(copyMolded.value).toBe(molded.value);
    });

    it("should round-trip complex nested structures", async () => {
        const ctx = createPreludeContext();
        const molded = await ex(ctx, parse('mold [x: 5 data: [1 2 3] msg: "test"]'));

        // Parse it back - molded.value is the string representation
        const parsed = parse(molded.value);
        const block = parsed.items[0]; // First item is the block
        expect(block.items.length).toBe(6); // x: 5 data: [1 2 3] msg: "test"

        // Should be valid block when evaluated
        const result = await ex(ctx, block);
        expect(result.value).toBe("test"); // Last value
    });
});
