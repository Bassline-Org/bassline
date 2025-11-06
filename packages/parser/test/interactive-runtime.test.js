import { beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "../src/interactive-runtime.js";
import { formatResults } from "../src/format-results.js";

describe("Interactive Runtime", () => {
  let rt;

  beforeEach(() => {
    rt = new Runtime();
  });

  describe("Basic Functionality", () => {
    it("should execute insert commands", () => {
      const beforeCount = rt.graph.edges.length;
      const result = rt.eval("insert { alice age 30 * }");

      // Returns array of contexts (strings)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(typeof result[0]).toBe("string");

      // Verify edge was added to graph
      expect(rt.graph.edges.length).toBe(beforeCount + 1);
      const addedEdge = rt.graph.edges[rt.graph.edges.length - 1];
      expect(addedEdge.source).toBe("ALICE");
      expect(addedEdge.attr).toBe("AGE");
      expect(addedEdge.target).toBe(30);
    });

    it("should execute query commands", () => {
      rt.eval("insert { alice age 30 * bob age 25 * }");

      const result = rt.eval("query where { ?x age ?a * }");

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
        "rule adult-check where { ?p age ?a * } produce { ?p adult true * }"
      );

      // Returns rule name (string)
      expect(typeof result).toBe("string");
      expect(result).toBe("ADULT-CHECK");

      // Rule should be tracked in context
      expect(rt.getActiveRules()).toContain("ADULT-CHECK");

      // Rule should fire when pattern matches
      rt.eval("insert { alice age 30 * }");
      const adultQuery = rt.eval("query where { alice adult ?status * }");
      expect(adultQuery[0].get("?STATUS")).toBe("TRUE");
    });

    it("should execute pattern commands", () => {
      const result = rt.eval("pattern people { ?x type person * }");

      // Returns pattern name (string, not array)
      expect(result).toBe("PEOPLE");

      // Pattern should be tracked
      expect(rt.getActivePatterns()).toContain("PEOPLE");
    });
  });

  describe("Single-Word Shorthand", () => {
    it("should expand single word to query", () => {
      rt.eval("insert { alice age 30 * alice city NYC * }");

      const result = rt.eval("alice");

      // Should return query results
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0] instanceof Map).toBe(true);
    });

    it("should handle entity names with colons", () => {
      rt.eval("insert { rule:MY-RULE type rule * }");

      const result = rt.eval("rule:MY-RULE");

      expect(result.length).toBe(1);
      expect(result[0].get("?ATTR")).toBe("TYPE");
      expect(result[0].get("?TARGET")).toBe("RULE");
    });

    it("should not expand multi-word expressions", () => {
      // This should parse normally, not as shorthand
      const result = rt.eval("query where { alice age ?a * }");

      expect(result[0]).toBe(undefined); // No data yet
    });
  });

  describe("Convenience Methods", () => {
    it("should provide query() helper", () => {
      rt.eval("insert { alice age 30 * }");

      const result = rt.query("alice age ?a *");

      expect(result[0].get("?A")).toBe(30);
    });

    it("should provide fact() helper", () => {
      const beforeCount = rt.graph.edges.length;
      const result = rt.fact("bob city Boston *");

      expect(result.length).toBe(1);
      expect(rt.graph.edges.length).toBe(beforeCount + 1);
    });
  });

  describe("Reset Functionality", () => {
    it("should clear graph and context", () => {
      rt.eval("insert { alice age 30 * }");
      rt.eval("rule test where { ?x age ?a * } produce { ?x adult true * }");

      expect(rt.graph.edges.length).toBeGreaterThan(0);
      expect(rt.getActiveRules().length).toBeGreaterThan(0);

      rt.reset();

      // Graph should be cleared (but extensions add metadata)
      expect(rt.graph.edges.length).toBeGreaterThan(0); // Extensions add metadata
      expect(rt.getActiveRules().length).toBe(0);
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      rt.eval("insert { alice age 30 * bob age 25 * }");

      const json = rt.toJSON();

      expect(json.edges).toBeDefined();
      expect(Array.isArray(json.edges)).toBe(true);
      expect(json.edges.length).toBeGreaterThan(0);
    });

    it("should restore from JSON", () => {
      rt.eval("insert { alice age 30 * }");
      const json = rt.toJSON();

      rt.reset();
      rt.fromJSON(json);

      const result = rt.eval("query where { alice age ?a * }");
      expect(result.length).toBe(1);
      expect(result[0].get("?A")).toBe(30);
    });
  });

  describe("Statistics", () => {
    it("should return graph statistics", () => {
      rt.eval("insert { alice age 30 * }");
      rt.eval("rule test where { ?x age ?a * } produce { ?x adult true * }");

      const stats = rt.getStats();

      expect(stats.edges).toBeGreaterThan(0);
      expect(stats.rules).toBe(1);
      expect(stats.patterns).toBe(0);
    });
  });

  describe("Integration", () => {
    it("should handle complex workflow", () => {
      // Add data
      rt.eval("insert { alice age 30 * bob age 25 * }");

      // Create rule
      rt.eval("rule adult-check where { ?x age ?a * } produce { ?x adult true * }");

      // Verify rule fired
      const adults = rt.query("?x adult true *");
      expect(adults.length).toBe(2);

      // Explore entity
      const aliceInfo = rt.eval("alice");
      expect(aliceInfo.length).toBe(2); // age and adult
    });

    it("should handle cascading rules", () => {
      rt.eval("rule verify where { ?x type person * } produce { ?x verified true * }");
      rt.eval("rule process where { ?x verified true * } produce { ?x processed true * }");

      rt.eval("insert { alice type person * }");

      // Both rules should have fired
      const verified = rt.query("alice verified ?v *");
      expect(verified[0].get("?V")).toBe("TRUE");

      const processed = rt.query("alice processed ?p *");
      expect(processed[0].get("?P")).toBe("TRUE");
    });
  });
});

describe("Result Formatting", () => {
  it("should format empty results", () => {
    const formatted = formatResults([]);
    expect(formatted).toBe("(no results)");
  });

  it("should format fact results (contexts)", () => {
    const formatted = formatResults(["ctx-1", "ctx-2", "ctx-3"]);
    expect(formatted).toContain("Added 3 edge(s)");
  });

  it("should format query results (bindings)", () => {
    const bindings = [
      new Map([["?X", "ALICE"], ["?A", 30]]),
      new Map([["?X", "BOB"], ["?A", 25]]),
    ];
    const formatted = formatResults(bindings);
    expect(formatted).toContain("ALICE");
    expect(formatted).toContain("BOB");
  });

  it("should format rule/pattern results (names)", () => {
    const formatted = formatResults("MY-RULE");
    expect(formatted).toBe("MY-RULE");
  });

  it("should format watch results", () => {
    const formatted = formatResults({ unwatch: () => {} });
    expect(formatted).toBe("Watch registered");
  });
});
