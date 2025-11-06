import { describe, it, expect, beforeEach } from "vitest";
import { Graph } from "../src/minimal-graph.js";

describe("Context Functionality", () => {
  let g;

  beforeEach(() => {
    g = new Graph();
  });

  describe("Edge Creation with Contexts", () => {
    it("should auto-generate context when null", () => {
      const id1 = g.add("Alice", "age", 30, null);
      const id2 = g.add("Bob", "age", 25, null);

      // Returns edge IDs
      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id1).not.toBe(id2);

      // Contexts are auto-generated
      expect(g.edges[0].context).toBe("edge:0");
      expect(g.edges[1].context).toBe("edge:1");
    });

    it("should return explicit context", () => {
      const id = g.add("Alice", "city", "NYC", "census-2024");
      // Returns edge ID
      expect(id).toBe(0);
      // Context is stored correctly
      expect(g.edges[0].context).toBe("census-2024");
    });

    it("should create edge with context field", () => {
      g.add("Alice", "age", 30, "census-2024");

      expect(g.edges.length).toBe(1);
      expect(g.edges[0]).toMatchObject({
        source: "Alice",
        attr: "age",
        target: 30,
        context: "census-2024",
      });
    });

    it("should handle default parameter (null)", () => {
      const id = g.add("Alice", "age", 30);
      // Returns edge ID
      expect(id).toBe(0);
      // Context is auto-generated
      expect(g.edges[0].context).toBe("edge:0");
    });
  });

  describe("Deduplication by 4-Tuple", () => {
    it("should deduplicate same 4-tuple", () => {
      const id1 = g.add("Alice", "age", 30, "ctx-1");
      const id2 = g.add("Alice", "age", 30, "ctx-1");

      // Returns same edge ID for duplicate
      expect(id1).toBe(id2);
      expect(id1).toBe(0);
      expect(g.edges.length).toBe(1);
      // Context is correct
      expect(g.edges[0].context).toBe("ctx-1");
    });

    it("should create different edges for different contexts", () => {
      g.add("Alice", "age", 30, "ctx-1");
      g.add("Alice", "age", 30, "ctx-2");

      expect(g.edges.length).toBe(2);
      expect(g.edges[0].context).toBe("ctx-1");
      expect(g.edges[1].context).toBe("ctx-2");
    });

    it("should create different edges for auto-generated contexts", () => {
      g.add("Alice", "age", 30, null);
      g.add("Alice", "age", 30, null);

      expect(g.edges.length).toBe(2);
      expect(g.edges[0].context).toBe("edge:0");
      expect(g.edges[1].context).toBe("edge:1");
    });

    it("should allow same s/a/t with different contexts", () => {
      g.add("Alice", "age", 30, "source-A");
      g.add("Alice", "age", 30, "source-B");
      g.add("Alice", "age", 30, "source-C");

      expect(g.edges.length).toBe(3);
    });
  });

  describe("Pattern Matching with Contexts", () => {
    beforeEach(() => {
      g.add("Alice", "age", 30, "census-2024");
      g.add("Bob", "age", 25, "survey-2024");
      g.add("Charlie", "age", 35, "census-2024");
    });

    it("should match specific context literal", () => {
      const results = g.query(["?p", "age", "?a", "census-2024"]);

      expect(results.length).toBe(2);
      const people = results.map((r) => r.get("?p")).sort();
      expect(people).toEqual(["Alice", "Charlie"]);
    });

    it("should bind context to variable", () => {
      const results = g.query(["Alice", "age", "?a", "?ctx"]);

      expect(results.length).toBe(1);
      expect(results[0].get("?ctx")).toBe("census-2024");
      expect(results[0].get("?a")).toBe(30);
    });

    it("should match wildcard context", () => {
      const results = g.query(["?p", "age", "?a", "*"]);

      expect(results.length).toBe(3);
    });

    it("should match auto-generated context", () => {
      g.add("Dave", "age", 40, null); // auto-gen: "edge:3"

      const results = g.query(["Dave", "age", "?a", "edge:3"]);

      expect(results.length).toBe(1);
      expect(results[0].get("?a")).toBe(40);
    });

    it("should match variable context", () => {
      const results = g.query(["?p", "age", "?a", "?ctx"]);

      expect(results.length).toBe(3);

      const contexts = results.map((r) => r.get("?ctx")).sort();
      expect(contexts).toEqual(["census-2024", "census-2024", "survey-2024"]);
    });

    it("should not match wrong context", () => {
      const results = g.query(["Alice", "age", "?a", "survey-2024"]);
      expect(results.length).toBe(0);
    });
  });

  describe("Multi-Pattern Matching with Contexts", () => {
    it("should join patterns across contexts", () => {
      g.add("Alice", "age", 30, "census");
      g.add("Alice", "city", "NYC", "profile");

      const results = g.query(
        ["?p", "age", "?a", "census"],
        ["?p", "city", "?c", "profile"],
      );

      expect(results.length).toBe(1);
      expect(results[0].get("?p")).toBe("Alice");
      expect(results[0].get("?a")).toBe(30);
      expect(results[0].get("?c")).toBe("NYC");
    });

    it("should bind same context variable across patterns", () => {
      g.add("Alice", "age", 30, "ctx-1");
      g.add("Alice", "city", "NYC", "ctx-1");
      g.add("Bob", "age", 25, "ctx-2");
      g.add("Bob", "city", "LA", "ctx-3");

      const results = g.query(
        ["?p", "age", "?a", "?ctx"],
        ["?p", "city", "?c", "?ctx"],
      );

      expect(results.length).toBe(1);
      expect(results[0].get("?p")).toBe("Alice");
    });
  });

  describe("Relations About Contexts", () => {
    it("should make edges about contexts", () => {
      const batchId = "import-batch-1";
      g.add("Alice", "age", 30, batchId);
      g.add("Bob", "age", 25, batchId);

      // Add metadata about the batch
      g.add(batchId, "source", "census");
      g.add(batchId, "confidence", 0.95);
      g.add(batchId, "timestamp", Date.now());

      const metadata = g.query([batchId, "?attr", "?value", "*"]);
      expect(metadata.length).toBe(3);
    });

    it("should query data and its context metadata together", () => {
      const ctx = "census-2024";
      g.add("Alice", "age", 30, ctx);
      g.add(ctx, "confidence", 0.95, null);

      const results = g.query(
        ["Alice", "age", "?age", ctx],
        [ctx, "confidence", "?conf", "*"],
      );

      expect(results.length).toBe(1);
      expect(results[0].get("?age")).toBe(30);
      expect(results[0].get("?conf")).toBe(0.95);
    });

    it("should use contexts as both source and target", () => {
      const ctx1 = "batch-1";
      const ctx2 = "batch-2";

      g.add("Alice", "imported", true, ctx1);
      g.add("Bob", "imported", true, ctx2);

      // Link batches
      g.add(ctx2, "refines", ctx1, null);

      const chain = g.query([ctx2, "refines", ctx1, "*"]);
      expect(chain.length).toBe(1);
    });
  });

  describe("Watchers with Contexts", () => {
    it("should fire watchers for matching context", () => {
      const matches = [];

      g.watch([["?p", "age", "?a", "real-time"]], (bindings) => {
        matches.push(bindings.get("?p"));
      });

      g.add("Alice", "age", 30, "real-time");
      g.add("Bob", "age", 25, "batch");
      g.add("Charlie", "age", 35, "real-time");

      expect(matches).toEqual(["Alice", "Charlie"]);
    });

    it("should fire watchers with context variable binding", () => {
      const contexts = [];

      g.watch([["?p", "age", "?a", "?ctx"]], (bindings) => {
        contexts.push(bindings.get("?ctx"));
      });

      g.add("Alice", "age", 30, "ctx-1");
      g.add("Bob", "age", 25, "ctx-2");

      expect(contexts).toEqual(["ctx-1", "ctx-2"]);
    });

    it("should not fire for non-matching context", () => {
      let fired = false;

      g.watch([["?p", "age", "?a", "census"]], () => {
        fired = true;
      });

      g.add("Alice", "age", 30, "survey");

      expect(fired).toBe(false);
    });
  });

  describe("Helper Methods", () => {
    beforeEach(() => {
      g.add("Alice", "age", 30, "census-2024");
      g.add("Bob", "age", 25, "survey-2024");
      g.add("Charlie", "age", 35, "census-2024");
      g.add("Dave", "age", 40, null);
    });

    it("should get edges in specific context", () => {
      const censusEdges = g.getEdgesInContext("census-2024");

      expect(censusEdges.length).toBe(2);
      expect(censusEdges[0].source).toBe("Alice");
      expect(censusEdges[1].source).toBe("Charlie");
    });

    it("should list all unique contexts", () => {
      const contexts = g.listContexts();

      expect(contexts.length).toBe(3);
      expect(contexts).toContain("census-2024");
      expect(contexts).toContain("survey-2024");
      expect(contexts).toContain("edge:3");
    });

    it("should return empty array for non-existent context", () => {
      const edges = g.getEdgesInContext("non-existent");
      expect(edges.length).toBe(0);
    });
  });

  describe("Selective Activation with Contexts", () => {
    it("should only activate patterns watching specific context", () => {
      let censusCount = 0;
      let surveyCount = 0;

      g.watch([["?p", "age", "?a", "census"]], () => censusCount++);
      g.watch([["?p", "age", "?a", "survey"]], () => surveyCount++);

      g.add("Alice", "age", 30, "census");
      g.add("Bob", "age", 25, "census");
      g.add("Charlie", "age", 35, "survey");

      expect(censusCount).toBe(2);
      expect(surveyCount).toBe(1);
    });

    it("should activate wildcard patterns for any context", () => {
      let count = 0;

      g.watch([["?p", "age", "?a", "*"]], () => count++);

      g.add("Alice", "age", 30, "ctx-1");
      g.add("Bob", "age", 25, "ctx-2");
      g.add("Charlie", "age", 35, "ctx-3");

      expect(count).toBe(3);
    });

    it("should activate variable context patterns for any context", () => {
      let count = 0;

      g.watch([["?p", "age", "?a", "?ctx"]], () => count++);

      g.add("Alice", "age", 30, "ctx-1");
      g.add("Bob", "age", 25, "ctx-2");

      expect(count).toBe(2);
    });
  });

  describe("NAC with Contexts", () => {
    it("should respect NAC with context matching", () => {
      g.add("Alice", "age", 30, "census");
      g.add("Bob", "age", 25, "survey");
      g.add("Alice", "deleted", true, null);

      const results = g.query({
        patterns: [["?p", "age", "?a", "census"]],
        nac: [["?p", "deleted", true, "*"]],
      });

      expect(results.length).toBe(0); // Alice filtered out by NAC
    });

    it("should allow NAC with specific context", () => {
      g.add("Alice", "age", 30, "census");
      g.add("Bob", "age", 25, "census");
      g.add("Alice", "deleted", true, "archive");

      const results = g.query({
        patterns: [["?p", "age", "?a", "census"]],
        nac: [["?p", "deleted", true, "active"]],
      });

      expect(results.length).toBe(2); // NAC doesn't match (different context)
    });
  });

  describe("Batch Operations with Contexts", () => {
    it("should handle contexts in batch mode", () => {
      const txId = "tx-123";

      g.batch(() => {
        g.add("Alice", "age", 30, txId);
        g.add("Bob", "age", 25, txId);
        g.add("Charlie", "age", 35, txId);
      });

      expect(g.edges.length).toBe(3);
      expect(g.edges.every((e) => e.context === txId)).toBe(true);
    });

    it("should fire patterns after batch completes with contexts", () => {
      let count = 0;

      g.watch([["?p", "age", "?a", "batch-ctx"]], () => count++);

      g.batch(() => {
        g.add("Alice", "age", 30, "batch-ctx");
        g.add("Bob", "age", 25, "batch-ctx");
      });

      expect(count).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null context as literal in pattern", () => {
      g.add("Alice", "age", 30, null); // Auto-gen: "edge:0"
      g.add("Bob", "age", 25, null); // Auto-gen: "edge:1"

      // Querying for null won't match auto-generated contexts
      const results = g.query([["?p", "age", "?a", null]]);

      expect(results.length).toBe(0); // null gets auto-converted to "edge:N"
    });

    it("should handle empty string context", () => {
      const id = g.add("Alice", "age", 30, "");
      // Returns edge ID
      expect(id).toBe(0);
      // Context is empty string
      expect(g.edges[0].context).toBe("");
    });

    it("should handle numeric context", () => {
      const id = g.add("Alice", "age", 30, 123);
      // Returns edge ID
      expect(id).toBe(0);
      // Context is numeric
      expect(g.edges[0].context).toBe(123);
    });

    it("should handle object as context", () => {
      const ctxObj = { batch: 1 };
      const id = g.add("Alice", "age", 30, ctxObj);
      // Returns edge ID
      expect(id).toBe(0);
      // Context is object reference
      expect(g.edges[0].context).toBe(ctxObj);
    });
  });

  describe("Performance: Context Indexing", () => {
    it("should index pure literal patterns by context if no other literals", () => {
      // Pure literal pattern with only context literal (unlikely in practice)
      // watch() expects array of patterns, so wrap in array
      g.watch([["Alice", "age", 30, "real-time"]], () => {});

      // Should be indexed under source (most specific)
      expect(g.sourceIndex.has("Alice")).toBe(true);
    });

    it("should put patterns with variables in wildcardPatterns", () => {
      g.watch([["?p", "age", "?a", "real-time"]], () => {});

      // Has variables, so goes to wildcardPatterns (not literal indexes)
      expect(g.wildcardPatterns.size).toBe(1);
    });

    it("should not index wildcard context patterns in contextIndex", () => {
      g.watch([["?p", "age", "?a", "*"]], () => {});

      // Should be in wildcardPatterns, not contextIndex
      expect(g.wildcardPatterns.size).toBe(1);
    });

    it("should not index variable context patterns in contextIndex", () => {
      g.watch([["?p", "age", "?a", "?ctx"]], () => {});

      // Should be in wildcardPatterns
      expect(g.wildcardPatterns.size).toBe(1);
    });
  });
});
