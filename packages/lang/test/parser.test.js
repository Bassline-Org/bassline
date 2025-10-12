// test/parser.test.js
import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import {
    BlockCell,
    GetWordCell,
    LitWordCell,
    NumberCell,
    ParenCell,
    PathCell,
    RefinementCell,
    SetWordCell,
    StringCell,
    WordCell,
} from "../src/cells/index.js";

describe("Parser - Basic Values", () => {
    it("parses positive integers", () => {
        const result = parse("42");
        expect(result).toBeInstanceOf(BlockCell);
        expect(result.buffer.data.length).toBe(1);

        const num = result.buffer.data[0];
        expect(num).toBeInstanceOf(NumberCell);
        expect(num.value).toBe(42);
    });

    it("parses negative integers", () => {
        const result = parse("-17");
        const num = result.buffer.data[0];
        expect(num.value).toBe(-17);
    });

    it("parses decimals", () => {
        const result = parse("3.14");
        const num = result.buffer.data[0];
        expect(num.value).toBe(3.14);
    });

    it("parses negative decimals", () => {
        const result = parse("-99.5");
        const num = result.buffer.data[0];
        expect(num.value).toBe(-99.5);
    });

    it("parses strings", () => {
        const result = parse('"hello world"');
        const str = result.buffer.data[0];
        expect(str).toBeInstanceOf(StringCell);
        expect(str.buffer.data.join("")).toBe("hello world");
    });

    it("parses strings with escape sequences", () => {
        const result = parse('"hello\\nworld"');
        const str = result.buffer.data[0];
        expect(str.buffer.data.join("")).toBe("hello\nworld");
    });

    it("parses empty strings", () => {
        const result = parse('""');
        const str = result.buffer.data[0];
        expect(str.buffer.data.join("")).toBe("");
    });
});

describe("Parser - Word Types", () => {
    it("parses regular words", () => {
        const result = parse("hello");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(WordCell);
        expect(word.binding).toBeUndefined(); // Unbound
    });

    it("parses SET-WORDs", () => {
        const result = parse("x:");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(SetWordCell);
        expect(word.binding).toBeUndefined();
    });

    it("parses GET-WORDs", () => {
        const result = parse(":x");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(GetWordCell);
        expect(word.binding).toBeUndefined();
    });

    it("parses LIT-WORDs", () => {
        const result = parse("'x");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(LitWordCell);
        expect(word.binding).toBeUndefined();
    });

    it("parses refinements", () => {
        const result = parse("/local");
        const ref = result.buffer.data[0];
        expect(ref).toBeInstanceOf(RefinementCell);
    });

    it("parses operator words", () => {
        const result = parse("+");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(WordCell);
    });

    it("parses operator SET-WORDs", () => {
        const result = parse("+:");
        const word = result.buffer.data[0];
        expect(word).toBeInstanceOf(SetWordCell);
    });
});

describe("Parser - Series", () => {
    it("parses empty blocks", () => {
        const result = parse("[]");
        const block = result.buffer.data[0];
        expect(block).toBeInstanceOf(BlockCell);
        expect(block.buffer.data.length).toBe(0);
    });

    it("parses blocks with values", () => {
        const result = parse("[1 2 3]");
        const block = result.buffer.data[0];
        expect(block).toBeInstanceOf(BlockCell);
        expect(block.buffer.data.length).toBe(3);
        expect(block.buffer.data[0].value).toBe(1);
        expect(block.buffer.data[1].value).toBe(2);
        expect(block.buffer.data[2].value).toBe(3);
    });

    it("parses nested blocks", () => {
        const result = parse("[[1 2] [3 4]]");
        const block = result.buffer.data[0];
        expect(block.buffer.data.length).toBe(2);
        expect(block.buffer.data[0]).toBeInstanceOf(BlockCell);
        expect(block.buffer.data[1]).toBeInstanceOf(BlockCell);
    });

    it("parses parens", () => {
        const result = parse("(1 + 2)");
        const paren = result.buffer.data[0];
        expect(paren).toBeInstanceOf(ParenCell);
        expect(paren.buffer.data.length).toBe(3);
    });

    it("parses mixed content in blocks", () => {
        const result = parse('[x: 42 "hello"]');
        const block = result.buffer.data[0];
        expect(block.buffer.data.length).toBe(3);
        expect(block.buffer.data[0]).toBeInstanceOf(SetWordCell);
        expect(block.buffer.data[1]).toBeInstanceOf(NumberCell);
        expect(block.buffer.data[2]).toBeInstanceOf(StringCell);
    });
});

describe("Parser - Paths", () => {
    it("parses simple paths", () => {
        const result = parse("object/field");
        const path = result.buffer.data[0];
        expect(path).toBeInstanceOf(PathCell);
        expect(path.buffer.data.length).toBe(2);
        expect(path.buffer.data[0]).toBeInstanceOf(WordCell);
        expect(path.buffer.data[1]).toBeInstanceOf(WordCell);
    });

    it("parses paths with numbers", () => {
        const result = parse("block/1");
        const path = result.buffer.data[0];
        expect(path.buffer.data.length).toBe(2);
        expect(path.buffer.data[0]).toBeInstanceOf(WordCell);
        expect(path.buffer.data[1]).toBeInstanceOf(NumberCell);
        expect(path.buffer.data[1].value).toBe(1);
    });

    it("parses multi-segment paths", () => {
        const result = parse("a/b/c/d");
        const path = result.buffer.data[0];
        expect(path.buffer.data.length).toBe(4);
    });

    it("parses paths with mixed segments", () => {
        const result = parse("obj/field/1/other");
        const path = result.buffer.data[0];
        expect(path.buffer.data.length).toBe(4);
        expect(path.buffer.data[2]).toBeInstanceOf(NumberCell);
    });
});

describe("Parser - Whitespace and Comments", () => {
    it("handles multiple spaces", () => {
        const result = parse("1    2    3");
        expect(result.buffer.data.length).toBe(3);
    });

    it("handles newlines", () => {
        const result = parse("1\n2\n3");
        expect(result.buffer.data.length).toBe(3);
    });

    it("handles comments", () => {
        const result = parse("1 ; this is a comment\n2");
        expect(result.buffer.data.length).toBe(2);
        expect(result.buffer.data[0].value).toBe(1);
        expect(result.buffer.data[1].value).toBe(2);
    });

    it("handles comments at end of input", () => {
        const result = parse("42 ; final comment");
        expect(result.buffer.data.length).toBe(1);
        expect(result.buffer.data[0].value).toBe(42);
    });
});

describe("Parser - Multiple Values", () => {
    it("parses multiple values", () => {
        const result = parse("x: 42 y: 10");
        expect(result.buffer.data.length).toBe(4);
        expect(result.buffer.data[0]).toBeInstanceOf(SetWordCell);
        expect(result.buffer.data[1]).toBeInstanceOf(NumberCell);
        expect(result.buffer.data[2]).toBeInstanceOf(SetWordCell);
        expect(result.buffer.data[3]).toBeInstanceOf(NumberCell);
    });

    it("returns empty block for empty input", () => {
        const result = parse("");
        expect(result).toBeInstanceOf(BlockCell);
        expect(result.buffer.data.length).toBe(0);
    });

    it("returns empty block for only whitespace", () => {
        const result = parse("   \n  \t  ");
        expect(result.buffer.data.length).toBe(0);
    });
});

describe("Parser - Error Handling", () => {
    it("throws on unclosed string", () => {
        expect(() => parse('"hello')).toThrow();
    });

    it("throws on unclosed block", () => {
        expect(() => parse("[1 2")).toThrow();
    });

    it("throws on unclosed paren", () => {
        expect(() => parse("(1 2")).toThrow();
    });

    it("throws on mismatched brackets", () => {
        expect(() => parse("[1 2)")).toThrow();
    });
});

describe("Parser - Complex Examples", () => {
    it("parses function definition", () => {
        const result = parse("double: func [x] [x + x]");
        expect(result.buffer.data.length).toBe(4);
        // double:
        expect(result.buffer.data[0]).toBeInstanceOf(SetWordCell);
        // func
        expect(result.buffer.data[1]).toBeInstanceOf(WordCell);
        // [x]
        expect(result.buffer.data[2]).toBeInstanceOf(BlockCell);
        // [x + x]
        expect(result.buffer.data[3]).toBeInstanceOf(BlockCell);
    });

    it("parses conditional expression", () => {
        const result = parse("if x > 5 [print x]");
        expect(result.buffer.data.length).toBe(5);
    });

    it("parses object literal", () => {
        const result = parse('[name: "John" age: 30]');
        const block = result.buffer.data[0];
        expect(block.buffer.data.length).toBe(4);
    });
});
