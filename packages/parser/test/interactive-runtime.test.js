import { beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "../src/interactive-runtime.js";
import { formatResults } from "../src/format-results.js";

describe("Interactive Runtime", () => {
  let rt;

  beforeEach(() => {
    rt = new Runtime();
  });

  describe("Basic Functionality", () => {
    it("should execute fact commands", () => {
      const beforeCount = rt.graph.edges.length;
      const result = rt.eval("fact [alice age 30]");

      // Returns array of edge IDs
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(typeof result[0]).toBe("number");

      // Verify edge was added to graph
      expect(rt.graph.edges.length).toBe(beforeCount + 1);
      const addedEdge = rt.graph.edges[rt.graph.edges.length - 1];
      expect(addedEdge.source).toBe("ALICE");
      expect(addedEdge.attr).toBe("AGE");
      expect(addedEdge.target).toBe(30);
    });

    it("should execute query commands", () => {
      rt.eval("fact [alice age 30 bob age 25]");

      const result = rt.eval("query [?x age ?a]");

      // Returns array of Maps
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0] instanceof Map).toBe(true);

      // Check bindings
      const bindings = result.map((m) => ({
        x: m.get("?X"),
        a: m.get("?A"),
      }));

      expect(bindings).toContainEqual({ x: "ALICE", a: 30 });
      expect(bindings).toContainEqual({ x: "BOB", a: 25 });
    });

    it("should execute rule commands", () => {
      const result = rt.eval(
        "rule adult-check [?p age ?a] -> [?p adult true]"
      );

      // Returns rule name (string)
      expect(typeof result).toBe("string");
      expect(result).toBe("ADULT-CHECK");

      // Rule should be tracked in context
      expect(rt.getActiveRules()).toContain("ADULT-CHECK");

      // Rule should fire when pattern matches
      rt.eval("fact [alice age 30]");
      const adultQuery = rt.eval("query [alice adult ?status]");
      expect(adultQuery[0].get("?STATUS")).toBe("TRUE");
    });

    it("should execute pattern commands", () => {
      const result = rt.eval("pattern people [?x type person]");

      // Returns pattern name (string, not array)
      expect(result).toBe("PEOPLE");

      // Pattern should be tracked
      expect(rt.getActivePatterns()).toContain("PEOPLE");
    });
  });

  describe("Single-Word Shorthand", () => {
    it("should expand single word to query", () => {
      rt.eval("fact [alice age 30 alice city NYC]");

      const result = rt.eval("alice");

      // Should return query results
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0] instanceof Map).toBe(true);
    });

    it("should handle entity names with colons", () => {
      rt.eval("fact [rule:MY-RULE type rule]");

      const result = rt.eval("rule:MY-RULE");

      expect(result.length).toBe(1);
      expect(result[0].get("?ATTR")).toBe("TYPE");
      expect(result[0].get("?TARGET")).toBe("RULE");
    });

    it("should not expand multi-word expressions", () => {
      // This should parse normally, not as shorthand
      const result = rt.eval("query [alice age ?a]");

      expect(result[0]).toBe(undefined); // No data yet
    });
  });

  describe("Convenience Methods", () => {
    it("should provide query() helper", () => {
      rt.eval("fact [alice age 30]");

      const result = rt.query("alice age ?a");

      expect(result[0].get("?A")).toBe(30);
    });

    it("should provide fact() helper", () => {
      const beforeCount = rt.graph.edges.length;
      const result = rt.fact("bob city Boston");

      expect(result.length).toBe(1);
      expect(rt.graph.edges.length).toBe(beforeCount + 1);
    });
  });

  describe("Reset Functionality", () => {
    it("should clear graph and context", () => {
      const initialEdgeCount = rt.graph.edges.length;  // Self-description edges
      rt.eval("fact [alice age 30]");
      rt.eval("rule test [?x age ?a] -> [?x adult true]");

      // Rules add self-description metadata, so more than initial
      expect(rt.graph.edges.length).toBeGreaterThan(initialEdgeCount);
      expect(rt.getActiveRules().length).toBe(1);

      rt.reset();

      // After reset, should have same initial self-description edges
      expect(rt.graph.edges.length).toBe(initialEdgeCount);
      expect(rt.getActiveRules().length).toBe(0);
      expect(rt.getActivePatterns().length).toBe(0);
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      const beforeCount = rt.graph.edges.length;
      rt.eval("fact [alice age 30 bob age 25]");

      const json = rt.toJSON();

      expect(json.edges).toBeDefined();
      expect(json.edges.length).toBe(beforeCount + 2);

      // Check that the user-added edges are present
      const userEdges = json.edges.slice(-2);  // Last 2 edges
      expect(userEdges).toContainEqual({
        source: "ALICE",
        attr: "AGE",
        target: 30,
      });
      expect(userEdges).toContainEqual({
        source: "BOB",
        attr: "AGE",
        target: 25,
      });
    });

    it("should restore from JSON", () => {
      const data = {
        edges: [
          { source: "ALICE", attr: "AGE", target: 30 },
          { source: "BOB", attr: "AGE", target: 25 },
        ],
      };

      const baselineCount = rt.graph.edges.length;
      rt.fromJSON(data);

      // fromJSON calls reset() which reinstalls extensions, so we have baseline + user edges
      expect(rt.graph.edges.length).toBe(baselineCount + 2);

      const result = rt.query("?x age ?a");
      expect(result.length).toBe(2);
    });
  });

  describe("Statistics", () => {
    it("should return graph statistics", () => {
      rt.eval("fact [alice age 30]");
      rt.eval("rule test [?x age ?a] -> [?x adult true]");
      rt.eval("pattern people [?x type person]");

      const stats = rt.getStats();

      // Rules and patterns add self-description metadata
      expect(stats.edges).toBeGreaterThan(1);
      expect(stats.rules).toBe(1);
      expect(stats.patterns).toBe(1);
    });
  });

  describe("Integration", () => {
    it("should handle complex workflow", () => {
      // Add data
      rt.eval("fact [alice type person alice age 30]");
      rt.eval("fact [bob type person bob age 25]");

      // Create rule
      rt.eval("rule adult-check [?p age ?a] -> [?p adult true]");

      // Verify rule fired
      const adults = rt.query("?x adult true");
      expect(adults.length).toBe(2);

      // Explore entity
      const aliceInfo = rt.eval("alice");
      expect(aliceInfo.length).toBeGreaterThan(0);

      // Check stats
      const stats = rt.getStats();
      expect(stats.edges).toBeGreaterThan(0);
      expect(stats.rules).toBe(1);
    });

    it("should handle cascading rules", () => {
      rt.eval("rule step1 [?x type person] -> [?x verified true]");
      rt.eval("rule step2 [?x verified true] -> [?x processed true]");

      rt.eval("fact [alice type person]");

      // Both rules should have fired
      const verified = rt.query("alice verified ?v");
      expect(verified[0].get("?V")).toBe("TRUE");

      const processed = rt.query("alice processed ?p");
      expect(processed[0].get("?P")).toBe("TRUE");
    });
  });
});

describe("Result Formatting", () => {
  it("should format empty results", () => {
    const result = formatResults([]);
    expect(result).toBe("(no results)");
  });

  it("should format fact results (edge IDs)", () => {
    const result = formatResults([0, 1, 2]);
    expect(result).toContain("Added 3 edge(s)");
  });

  it("should format query results (bindings)", () => {
    const bindings = [
      new Map([
        ["?X", "ALICE"],
        ["?A", 30],
      ]),
      new Map([
        ["?X", "BOB"],
        ["?A", 25],
      ]),
    ];

    const result = formatResults(bindings);
    expect(result).toContain("ALICE");
    expect(result).toContain("BOB");
    expect(result).toContain("30");
    expect(result).toContain("25");
  });

  it("should format rule/pattern results (names)", () => {
    const result = formatResults(["MY-RULE", "MY-PATTERN"]);
    expect(result).toBe("MY-RULE, MY-PATTERN");
  });

  it("should format watch results", () => {
    const result = formatResults([{ unwatch: () => {} }]);
    expect(result).toContain("Watch");
  });
});
