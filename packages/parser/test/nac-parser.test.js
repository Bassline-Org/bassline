import { describe, it, expect } from "vitest";
import { parsePattern, parsePatternSpec } from "../src/pattern-parser.js";

describe("NAC (Negative Application Conditions) Parser", () => {
  describe("Basic NAC patterns", () => {
    it("should parse query with NAC", () => {
      const result = parsePattern("query [?x type person | not ?x deleted true]");
      expect(result.type).toBe("program");
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "TYPE", "PERSON"]],
        nac: [["?X", "DELETED", "TRUE"]],
      });
    });

    it("should parse multiple NAC patterns", () => {
      const result = parsePattern(
        "query [?x type person | not ?x deleted true | not ?x archived true]"
      );
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "TYPE", "PERSON"]],
        nac: [
          ["?X", "DELETED", "TRUE"],
          ["?X", "ARCHIVED", "TRUE"],
        ],
      });
    });

    it("should parse mixed positive and negative patterns", () => {
      const result = parsePattern(
        "query [?x type person | ?x age ?a | not ?x deleted true]"
      );
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [
          ["?X", "TYPE", "PERSON"],
          ["?X", "AGE", "?A"],
        ],
        nac: [["?X", "DELETED", "TRUE"]],
      });
    });
  });

  describe("NAC in rules", () => {
    it("should parse rule with NAC in match", () => {
      const result = parsePattern(
        "rule active-adults [?p age ?a | not ?p deleted true] -> [?p status active]"
      );
      expect(result.commands[0]).toEqual({
        type: "rule",
        name: "ACTIVE-ADULTS",
        match: [["?P", "AGE", "?A"]],
        matchNac: [["?P", "DELETED", "TRUE"]],
        produce: [["?P", "STATUS", "ACTIVE"]],
        produceNac: [],
      });
    });

    it("should parse rule with NAC in produce", () => {
      const result = parsePattern(
        "rule ensure-unique [?p name ?n] -> [?p unique true | not ?p duplicate true]"
      );
      expect(result.commands[0]).toEqual({
        type: "rule",
        name: "ENSURE-UNIQUE",
        match: [["?P", "NAME", "?N"]],
        matchNac: [],
        produce: [["?P", "UNIQUE", "TRUE"]],
        produceNac: [["?P", "DUPLICATE", "TRUE"]],
      });
    });
  });

  describe("NAC in patterns", () => {
    it("should parse pattern with NAC", () => {
      const result = parsePattern(
        "pattern active-people [?p type person | not ?p deleted true]"
      );
      expect(result.commands[0]).toEqual({
        type: "pattern",
        name: "ACTIVE-PEOPLE",
        patterns: [["?P", "TYPE", "PERSON"]],
        nac: [["?P", "DELETED", "TRUE"]],
      });
    });
  });

  describe("NAC in watch commands", () => {
    it("should parse watch with NAC", () => {
      const result = parsePattern(
        "watch [?x needs-eval true | not ?x processing true] [?x processing true]"
      );
      expect(result.commands[0]).toEqual({
        type: "watch",
        match: [["?X", "NEEDS-EVAL", "TRUE"]],
        matchNac: [["?X", "PROCESSING", "TRUE"]],
        action: [["?X", "PROCESSING", "TRUE"]],
        actionNac: [],
      });
    });
  });

  describe("NAC with wildcards and variables", () => {
    it("should parse NAC with wildcards", () => {
      const result = parsePattern("query [?x type * | not ?x deleted true]");
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "TYPE", "*"]],
        nac: [["?X", "DELETED", "TRUE"]],
      });
    });

    it("should parse NAC with multiple variables", () => {
      const result = parsePattern(
        "query [?x likes ?y | not ?x hates ?y]"
      );
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "LIKES", "?Y"]],
        nac: [["?X", "HATES", "?Y"]],
      });
    });
  });

  describe("parsePatternSpec with NAC", () => {
    it("should return object with NAC when NAC patterns present", () => {
      const result = parsePatternSpec("?x type person | not ?x deleted true");
      expect(result).toEqual({
        patterns: [["?X", "TYPE", "PERSON"]],
        nac: [["?X", "DELETED", "TRUE"]],
      });
    });

    it("should return just patterns array when no NAC (backward compatibility)", () => {
      const result = parsePatternSpec("?x type person | ?x age ?a");
      expect(result).toEqual([
        ["?X", "TYPE", "PERSON"],
        ["?X", "AGE", "?A"],
      ]);
    });
  });

  describe("Complex NAC examples", () => {
    it("should parse orphan detection pattern", () => {
      const program = `
        ; Find entities with no relationships
        query [?x name ?n | not ?x type ?t | not ?x parent ?p]
      `;
      const result = parsePattern(program);
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [["?X", "NAME", "?N"]],
        nac: [
          ["?X", "TYPE", "?T"],
          ["?X", "PARENT", "?P"],
        ],
      });
    });

    it("should parse deletion-aware query", () => {
      const program = `
        ; Find active people
        query [?x type person | ?x age ?a | not ?x deleted true | not ?x archived true]
      `;
      const result = parsePattern(program);
      expect(result.commands[0]).toEqual({
        type: "query",
        patterns: [
          ["?X", "TYPE", "PERSON"],
          ["?X", "AGE", "?A"],
        ],
        nac: [
          ["?X", "DELETED", "TRUE"],
          ["?X", "ARCHIVED", "TRUE"],
        ],
      });
    });
  });
});