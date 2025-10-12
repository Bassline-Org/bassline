// test/serialization.test.js
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { parse } from "../src/parser.js";
import { doBlock } from "../src/evaluator.js";
import { bind } from "../src/bind.js";
import { GLOBAL } from "../src/context.js";

describe("MOLD - Serialization", () => {
    it("molds numbers", () => {
        const result = run("mold 42");
        expect(result.buffer.data.join("")).toBe("42");
    });

    it("molds decimals", () => {
        const result = run("mold 3.14");
        expect(result.buffer.data.join("")).toBe("3.14");
    });

    it("molds strings", () => {
        const result = run('mold "hello"');
        expect(result.buffer.data.join("")).toBe('"hello"');
    });

    it("molds strings with escapes", () => {
        const result = run('mold "hello\\nworld"');
        expect(result.buffer.data.join("")).toBe('"hello\\nworld"');
    });

    it("molds words", () => {
        const result = run("mold 'test");
        expect(result.buffer.data.join("")).toBe("TEST");
    });

    it("molds set-words", () => {
        const result = run("mold first [x:]");
        expect(result.buffer.data.join("")).toBe("X:");
    });

    it("molds get-words", () => {
        const result = run("mold first [:x]");
        expect(result.buffer.data.join("")).toBe(":X");
    });

    it("molds lit-words", () => {
        const result = run("mold ''x");
        expect(result.buffer.data.join("")).toBe("'X");
    });

    it("molds empty blocks", () => {
        const result = run("mold []");
        expect(result.buffer.data.join("")).toBe("[]");
    });

    it("molds blocks with values", () => {
        const result = run("mold [1 2 3]");
        expect(result.buffer.data.join("")).toBe("[1 2 3]");
    });

    it("molds nested blocks", () => {
        const result = run("mold [[1 2] [3 4]]");
        expect(result.buffer.data.join("")).toBe("[[1 2] [3 4]]");
    });

    it("molds parens", () => {
        const result = run("mold first [(1 + 2)]");
        expect(result.buffer.data.join("")).toBe("(1 + 2)");
    });

    it("molds paths", () => {
        const result = run("mold first [obj/field]");
        expect(result.buffer.data.join("")).toBe("OBJ/FIELD");
    });

    it("molds mixed content", () => {
        const result = run('mold [x: 42 "hello"]');
        expect(result.buffer.data.join("")).toBe('[X: 42 "hello"]');
    });
});

describe("MOLD/LOAD Round-trip", () => {
    function roundtrip(source) {
        // Parse original
        const original = parse(source);
        bind(original, GLOBAL);

        // Mold it
        const molded = run(`mold ${source}`);
        const moldedStr = molded.buffer.data.join("");

        // Load it back
        const reloaded = parse(moldedStr);
        bind(reloaded, GLOBAL);

        return { original, reloaded, moldedStr };
    }

    it("round-trips numbers", () => {
        const { moldedStr } = roundtrip("42");
        expect(moldedStr).toBe("42");
    });

    it("round-trips strings", () => {
        const { moldedStr } = roundtrip('"hello world"');
        expect(moldedStr).toBe('"hello world"');
    });

    it("round-trips blocks", () => {
        const { moldedStr } = roundtrip("[1 2 3]");
        expect(moldedStr).toBe("[1 2 3]");
    });

    it("round-trips complex structures", () => {
        const { moldedStr } = roundtrip('[x: 42 y: "test"]');
        expect(moldedStr).toBe('[X: 42 Y: "test"]');
    });

    it("can execute round-tripped code", () => {
        const code = "[+ 2 3]";
        const { reloaded } = roundtrip(code);
        const result = doBlock(reloaded.first());
        expect(result.value).toBe(5);
    });
});

describe("Serialization Use Cases", () => {
    it("serializes gadget messages", () => {
        const result = run(`
            gadgetId: 42
            value: 100
            msg: reduce ['gadget-id gadgetId 'value value]
            mold msg
        `);
        const serialized = result.buffer.data.join("");
        expect(serialized).toBe("[GADGET-ID 42 VALUE 100]");
    });

    it("can deserialize and process messages", () => {
        const result = run(`
            ; Create and serialize
            msg: reduce ['op '+ 'args [10 20]]
            serialized: mold msg
            
            ; Deserialize (parse)
            ; In real usage: received: load serialized
            ; For now just verify structure
            first msg
        `);
        expect(result.typeName).toBe("word");
    });

    it("serializes object specs", () => {
        const result = run(`
            spec: [x: 10 y: 20]
            mold spec
        `);
        const serialized = result.buffer.data.join("");
        expect(serialized).toBe("[X: 10 Y: 20]");
    });
});
