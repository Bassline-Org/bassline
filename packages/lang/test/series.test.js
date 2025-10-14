import { describe, expect, it } from "vitest";
import { createRepl } from "../src/repl.js";

describe("Series - first/last", () => {
    it("should get first element", async () => {
        const repl = createRepl();
        const result = await repl.eval("first [1 2 3]");
        expect(result.value.value).toBe(1);
    });

    it("should get last element", async () => {
        const repl = createRepl();
        const result = await repl.eval("last [1 2 3]");
        expect(result.value.value).toBe(3);
    });
});

describe("Series - length", () => {
    it("should get length of block", async () => {
        const repl = createRepl();
        const result = await repl.eval("length [1 2 3 4 5]");
        expect(result.value.value).toBe(5);
    });

    it("should get length of string", async () => {
        const repl = createRepl();
        const result = await repl.eval('length "hello"');
        expect(result.value.value).toBe(5);
    });
});

describe("Series - append/insert", () => {
    it("should append to block", async () => {
        const repl = createRepl();
        const result = await repl.eval("append [1 2] 3");
        expect(result.value.items.length).toBe(3);
        expect(result.value.items[2].value).toBe(3);
    });

    it("should insert at beginning", async () => {
        const repl = createRepl();
        const result = await repl.eval("insert [2 3] 1");
        expect(result.value.items.length).toBe(3);
        expect(result.value.items[0].value).toBe(1);
    });
});

describe("Series - at/pick", () => {
    it("should get slice starting at index", async () => {
        const repl = createRepl();
        const result = await repl.eval("at [1 2 3 4] 2");
        expect(result.value.items.length).toBe(3);
        expect(result.value.items[0].value).toBe(2);
    });

    it("should get element at index", async () => {
        const repl = createRepl();
        const result = await repl.eval("pick [10 20 30] 2");
        expect(result.value.value).toBe(20);
    });
});

describe("Series - empty?", () => {
    it("should detect empty block", async () => {
        const repl = createRepl();
        const result = await repl.eval("empty? []");
        expect(result.value).toBe(true);
    });

    it("should detect non-empty block", async () => {
        const repl = createRepl();
        const result = await repl.eval("empty? [1]");
        expect(result.value).toBe(false);
    });

    it("should detect empty string", async () => {
        const repl = createRepl();
        const result = await repl.eval('empty? ""');
        expect(result.value).toBe(true);
    });
});

describe("Series - Integration", () => {
    it("should build list with append", async () => {
        const repl = createRepl();
        await repl.eval("list: []");
        await repl.eval("list: append list 1");
        await repl.eval("list: append list 2");
        await repl.eval("list: append list 3");

        const result = await repl.eval("list");
        expect(result.value.items.length).toBe(3);
    });

    it("should use with foreach", async () => {
        const repl = createRepl();
        await repl.eval("list: [10 20 30]");
        await repl.eval("total: 0");
        await repl.eval("foreach item list [total: + total item]");

        const result = await repl.eval("total");
        expect(result.value.value).toBe(60);
    });
});
