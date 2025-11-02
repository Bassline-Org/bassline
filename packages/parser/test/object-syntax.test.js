import { describe, it, expect } from "vitest";
import { parsePattern, parsePatternSpec } from "../src/pattern-parser.js";

describe("Object Syntax Parser", () => {
  describe("Basic object syntax", () => {
    it("should parse object syntax in facts", () => {
      const result = parsePattern(`
        fact [
          alice {
            type person
            age 30
            city "NYC"
          }
        ]
      `);

      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe("fact");
      expect(result.commands[0].triples).toEqual([
        ["ALICE", "TYPE", "PERSON"],
        ["ALICE", "AGE", 30],
        ["ALICE", "CITY", "NYC"]
      ]);
    });

    it("should parse multiple objects in one fact", () => {
      const result = parsePattern(`
        fact [
          alice { type person age 30 }
          bob { type person age 25 }
        ]
      `);

      expect(result.commands[0].triples).toEqual([
        ["ALICE", "TYPE", "PERSON"],
        ["ALICE", "AGE", 30],
        ["BOB", "TYPE", "PERSON"],
        ["BOB", "AGE", 25]
      ]);
    });

    it("should mix object syntax with regular triples", () => {
      const result = parsePattern(`
        fact [
          alice { type person age 30 }
          bob type person
          charlie { age 35 city "Austin" }
        ]
      `);

      expect(result.commands[0].triples).toEqual([
        ["ALICE", "TYPE", "PERSON"],
        ["ALICE", "AGE", 30],
        ["BOB", "TYPE", "PERSON"],
        ["CHARLIE", "AGE", 35],
        ["CHARLIE", "CITY", "Austin"]
      ]);
    });
  });

  describe("Object syntax in patterns", () => {
    it("should parse object syntax in queries", () => {
      const result = parsePattern(`
        query [?x { type person age ?a }]
      `);

      expect(result.commands[0].patterns).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"]
      ]);
    });

    it("should parse NAC with object syntax", () => {
      const result = parsePattern(`
        query [
          ?x type person
          not ?x { deleted true archived true }
        ]
      `);

      expect(result.commands[0].patterns).toEqual([
        ["?X", "TYPE", "PERSON"]
      ]);
      expect(result.commands[0].nac).toEqual([
        ["?X", "DELETED", "TRUE"],
        ["?X", "ARCHIVED", "TRUE"]
      ]);
    });

    it("should parse rules with object syntax", () => {
      const result = parsePattern(`
        rule process-order [
          ?order { quantity ?q price ?p }
        ] -> [
          ?order { status processing total-pending true }
        ]
      `);

      expect(result.commands[0].match).toEqual([
        ["?ORDER", "QUANTITY", "?Q"],
        ["?ORDER", "PRICE", "?P"]
      ]);
      expect(result.commands[0].produce).toEqual([
        ["?ORDER", "STATUS", "PROCESSING"],
        ["?ORDER", "TOTAL-PENDING", "TRUE"]
      ]);
    });
  });

  describe("No pipe separator needed", () => {
    it("should parse patterns without pipe separators", () => {
      const result = parsePattern(`
        query [
          ?x type person
          ?x age ?a
          ?x city ?c
        ]
      `);

      expect(result.commands[0].patterns).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"],
        ["?X", "CITY", "?C"]
      ]);
    });

    it("should parse mixed patterns and NAC without pipes", () => {
      const result = parsePattern(`
        query [
          ?x type person
          ?x age ?a
          not ?x deleted true
          not ?x archived true
        ]
      `);

      expect(result.commands[0].patterns).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"]
      ]);
      expect(result.commands[0].nac).toEqual([
        ["?X", "DELETED", "TRUE"],
        ["?X", "ARCHIVED", "TRUE"]
      ]);
    });
  });

  describe("Empty objects", () => {
    it("should handle empty object syntax", () => {
      const result = parsePattern(`
        fact [alice { }]
      `);

      // Empty object produces no triples
      expect(result.commands[0].triples).toEqual([]);
    });
  });

  describe("parsePatternSpec compatibility", () => {
    it("should parse object syntax in parsePatternSpec", () => {
      const result = parsePatternSpec("?x { type person age ?a }");

      // Since there's no NAC, should return just the patterns array
      expect(result).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"]
      ]);
    });

    it("should return object format when NAC present", () => {
      const result = parsePatternSpec("?x type person not ?x deleted true");

      expect(result).toEqual({
        patterns: [["?X", "TYPE", "PERSON"]],
        nac: [["?X", "DELETED", "TRUE"]]
      });
    });
  });
});