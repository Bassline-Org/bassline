import { describe, expect, it } from "vitest";
import { createRepl } from "../src/repl.js";
import { Block, Str, Num } from "../src/values.js";
import { Context } from "../src/context.js";

describe("External Integration - String Operations", () => {
    it("should split strings", async () => {
        const repl = createRepl();
        const result = await repl.eval('split "hello,world,test" ","');
        expect(result.ok).toBe(true);
        expect(result.value instanceof Block).toBe(true);
        expect(result.value.items.length).toBe(3);
        expect(result.value.items[0].value).toBe("hello");
        expect(result.value.items[1].value).toBe("world");
        expect(result.value.items[2].value).toBe("test");
    });

    it("should join blocks with delimiter", async () => {
        const repl = createRepl();
        const result = await repl.eval('join ["hello" "world" "test"] ", "');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("hello, world, test");
    });

    it("should trim whitespace", async () => {
        const repl = createRepl();
        const result = await repl.eval('trim "  hello world  "');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("hello world");
    });

    it("should convert to uppercase", async () => {
        const repl = createRepl();
        const result = await repl.eval('uppercase "hello"');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("HELLO");
    });

    it("should convert to lowercase", async () => {
        const repl = createRepl();
        const result = await repl.eval('lowercase "WORLD"');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("world");
    });
});

describe("External Integration - JSON Operations", () => {
    it("should parse JSON objects", async () => {
        const repl = createRepl();
        const result = await repl.eval('parse-json "{\\"name\\":\\"John\\",\\"age\\":30}"');
        expect(result.ok).toBe(true);
        expect(result.value instanceof Context).toBe(true);
    });

    it("should parse JSON arrays", async () => {
        const repl = createRepl();
        const result = await repl.eval('parse-json "[1,2,3]"');
        expect(result.ok).toBe(true);
        expect(result.value instanceof Block).toBe(true);
        expect(result.value.items.length).toBe(3);
    });

    it("should serialize to JSON", async () => {
        const repl = createRepl();
        const result = await repl.eval('to-json [1 2 3]');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("[1,2,3]");
    });

    it("should round-trip JSON", async () => {
        const repl = createRepl();
        await repl.eval('data: parse-json "{\\"x\\":10,\\"y\\":20}"');
        const result = await repl.eval("to-json data");
        expect(result.ok).toBe(true);
        const parsed = JSON.parse(result.value.value);
        // Bassline normalizes all keys to uppercase
        expect(parsed.X).toBe(10);
        expect(parsed.Y).toBe(20);
    });
});

describe("External Integration - Context Operations", () => {
    it("should get values from context", async () => {
        const repl = createRepl();
        await repl.eval('data: parse-json "{\\"name\\":\\"Alice\\"}"');
        const result = await repl.eval('get data "name"');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe("Alice");
    });

    it("should set values in context", async () => {
        const repl = createRepl();
        await repl.eval('data: context');
        await repl.eval('data2: set data "x" 42');
        const result = await repl.eval('get data2 "x"');
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(42);
    });

    it("should get keys from context", async () => {
        const repl = createRepl();
        await repl.eval('data: parse-json "{\\"a\\":1,\\"b\\":2}"');
        const result = await repl.eval("keys data");
        expect(result.ok).toBe(true);
        expect(result.value instanceof Block).toBe(true);
        expect(result.value.items.length).toBe(2);
    });

    it("should get values from context", async () => {
        const repl = createRepl();
        await repl.eval('data: parse-json "{\\"a\\":1,\\"b\\":2}"');
        const result = await repl.eval("values data");
        expect(result.ok).toBe(true);
        expect(result.value instanceof Block).toBe(true);
        expect(result.value.items.length).toBe(2);
    });

    it("should check if key exists", async () => {
        const repl = createRepl();
        await repl.eval('data: parse-json "{\\"x\\":10}"');
        const result1 = await repl.eval('has? data "x"');
        expect(result1.ok).toBe(true);
        expect(result1.value).toBe(true);

        const result2 = await repl.eval('has? data "y"');
        expect(result2.ok).toBe(true);
        expect(result2.value).toBe(false);
    });
});

describe("External Integration - HTTP Operations", () => {
    it("should fetch data from URL", async () => {
        const repl = createRepl();
        // Use a reliable public API
        const result = await repl.eval(
            'fetch "https://api.github.com/repos/octocat/Hello-World"'
        );
        expect(result.ok).toBe(true);
        expect(result.value instanceof Str).toBe(true);
        expect(result.value.value).toContain("Hello-World");
    }, 10000); // 10 second timeout for network request

    it("should fetch and parse JSON from API", async () => {
        const repl = createRepl();
        await repl.eval('response: fetch "https://api.github.com/repos/octocat/Hello-World"');
        const result = await repl.eval("data: parse-json response");
        expect(result.ok).toBe(true);
        expect(result.value instanceof Context).toBe(true);

        // Verify we can extract fields
        const nameResult = await repl.eval('get data "name"');
        expect(nameResult.ok).toBe(true);
        expect(nameResult.value.value).toBe("Hello-World");
    }, 10000);

    it("should handle fetch errors gracefully", async () => {
        const repl = createRepl();
        const result = await repl.eval('fetch "https://invalid-domain-that-does-not-exist-12345.com"');
        expect(result.ok).toBe(false);
        expect(result.error).toContain("fetch failed");
    }, 10000);
});

describe("External Integration - Complete Workflow", () => {
    it("should fetch, parse, and manipulate JSON data", async () => {
        const repl = createRepl();

        // Fetch data
        await repl.eval('response: fetch "https://api.github.com/repos/octocat/Hello-World"');

        // Parse JSON
        await repl.eval("data: parse-json response");

        // Extract fields
        const nameResult = await repl.eval('get data "name"');
        expect(nameResult.ok).toBe(true);
        expect(nameResult.value.value).toBe("Hello-World");

        // Create modified version
        await repl.eval('data2: set data "custom" 42');

        // Verify modification
        const customResult = await repl.eval('get data2 "custom"');
        expect(customResult.ok).toBe(true);
        expect(customResult.value.value).toBe(42);

        // Serialize back to JSON
        const jsonResult = await repl.eval("to-json data2");
        expect(jsonResult.ok).toBe(true);
        // Bassline normalizes all keys to uppercase
        expect(jsonResult.value.value).toContain('"CUSTOM":42');
    }, 10000);

    it("should work with string manipulation and JSON", async () => {
        const repl = createRepl();

        // Create CSV-like data
        await repl.eval('csv: "name,age,city"');

        // Split into fields
        await repl.eval('fields: split csv ","');

        // Convert to JSON
        const result = await repl.eval("to-json fields");
        expect(result.ok).toBe(true);

        const parsed = JSON.parse(result.value.value);
        expect(parsed).toEqual(["name", "age", "city"]);
    });
});
