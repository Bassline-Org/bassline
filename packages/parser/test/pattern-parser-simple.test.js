import { describe, it, expect } from "vitest";
import {
  parsePattern,
  parsePatternSpec,
  number,
  string,
  word,
  patternVar,
  element,
  triple,
} from "../src/pattern-parser.js";

describe("Simple Pattern Parser", () => {
  describe("Basic Elements", () => {
    it("should parse numbers", () => {
      const result = number.run("42");
      expect(result.isError).toBe(false);
      expect(result.result).toBe(42);

      const result2 = number.run("-3.14");
      expect(result2.isError).toBe(false);
      expect(result2.result).toBe(-3.14);
    });

    it("should parse strings", () => {
      const result = string.run('"hello world"');
      expect(result.isError).toBe(false);
      expect(result.result).toBe("hello world");
    });

    it("should parse words and normalize to uppercase", () => {
      const result = word.run("alice");
      expect(result.isError).toBe(false);
      expect(result.result).toBe("ALICE");
    });

    it("should parse pattern variables", () => {
      const result = patternVar.run("?x");
      expect(result.isError).toBe(false);
      expect(result.result).toBe("?X");

      const result2 = patternVar.run("?thing-lovers");
      expect(result2.isError).toBe(false);
      expect(result2.result).toBe("?THING-LOVERS");
    });

    it("should parse wildcards", () => {
      const result = element.run("*");
      expect(result.isError).toBe(false);
      expect(result.result).toBe("*");
    });
  });

  describe("Triples", () => {
    it("should parse simple triples as arrays", () => {
      const result = triple.run("alice type person");
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(["ALICE", "TYPE", "PERSON"]);
    });

    it("should parse triples with variables", () => {
      const result = triple.run("?x likes ?y");
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(["?X", "LIKES", "?Y"]);
    });

    it("should parse triples with numbers", () => {
      const result = triple.run("counter value 42");
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(["COUNTER", "VALUE", 42]);
    });

    it("should parse triples with wildcards", () => {
      const result = triple.run("?x type *");
      expect(result.isError).toBe(false);
      expect(result.result).toEqual(["?X", "TYPE", "*"]);
    });
  });

  describe("Commands", () => {
    it("should parse fact commands", () => {
      const result = parsePattern("fact [alice type person bob type person]");
      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        type: "fact",
        triples: [
          ["ALICE", "TYPE", "PERSON"],
          ["BOB", "TYPE", "PERSON"],
        ],
      });
    });

    it("should parse query commands", () => {
      const result = parsePattern("query [?x type person]");
      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "TYPE", "PERSON"]],
      });
    });

    it("should parse queries with multiple patterns", () => {
      const result = parsePattern("query [?x type person ?x age ?a]");
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [
          ["?X", "TYPE", "PERSON"],
          ["?X", "AGE", "?A"],
        ],
      });
    });

    it("should parse rule commands", () => {
      const result = parsePattern(
        "rule adult-check [?p age ?a] -> [?p adult true]"
      );
      expect(result.commands[0]).toEqual({
        type: "rule",
        name: "ADULT-CHECK",
        match: [["?P", "AGE", "?A"]],
        produce: [["?P", "ADULT", "TRUE"]],
      });
    });

    it("should parse pattern commands", () => {
      const result = parsePattern("pattern finder [?x type person]");
      expect(result.commands[0]).toEqual({
        type: "pattern",
        name: "FINDER",
        patterns: [["?X", "TYPE", "PERSON"]],
      });
    });

    it("should parse watch commands", () => {
      const result = parsePattern(
        "watch [?x needs-eval true] [?x evaluated true]"
      );
      expect(result.commands[0]).toEqual({
        type: "watch",
        match: [["?X", "NEEDS-EVAL", "TRUE"]],
        action: [["?X", "EVALUATED", "TRUE"]],
      });
    });

    it("should parse delete commands", () => {
      const result = parsePattern("delete alice likes bob");
      expect(result.commands[0]).toEqual({
        type: "delete",
        triple: ["ALICE", "LIKES", "BOB"],
      });
    });

    it("should parse clear commands", () => {
      const result = parsePattern("clear-graph");
      expect(result.commands[0]).toEqual({
        type: "clear",
      });
    });

    it("should parse info commands", () => {
      const result = parsePattern("graph-info");
      expect(result.commands[0]).toEqual({
        type: "info",
      });
    });
  });

  describe("Programs", () => {
    it("should parse empty programs", () => {
      const result = parsePattern("");
      expect(result.type).toBe("program");
      expect(result.commands).toEqual([]);
    });

    it("should parse programs with multiple commands", () => {
      const program = `
        fact [alice type person]
        query [?x type person]
      `;
      const result = parsePattern(program);
      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(2);
      expect(result.commands[0].type).toBe("fact");
      expect(result.commands[1].type).toBe("query");
    });

    it("should handle comments", () => {
      const program = `
        ; This is a comment
        fact [alice type person]
        ; Another comment
        query [?x type person]
      `;
      const result = parsePattern(program);
      expect(result.commands).toHaveLength(2);
    });
  });

  describe("Pattern Specifications", () => {
    it("should parse pattern specs", () => {
      const result = parsePatternSpec("?x type person ?x age ?a");
      expect(result).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"],
      ]);
    });
  });

  describe("Complex Examples", () => {
    it("should parse the demo program", () => {
      const program = `
        ; Define facts about people
        fact [
          alice type person
          bob type person
          alice age 30
          alice likes coffee
        ]

        ; Define a rule
        rule make-friends [?x likes ?thing] -> [?x friend-of ?thing-lovers]

        ; Query for people
        query [?x type person]
      `;

      const result = parsePattern(program);
      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(3);

      // Check fact command
      expect(result.commands[0].type).toBe("fact");
      expect(result.commands[0].triples).toHaveLength(4);

      // Check rule command
      expect(result.commands[1].type).toBe("rule");
      expect(result.commands[1].name).toBe("MAKE-FRIENDS");

      // Check query command
      expect(result.commands[2].type).toBe("query");
    });
  });
});