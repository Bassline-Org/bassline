import { beforeEach, describe, expect, it } from "vitest";
import { Graph } from "../src/minimal-graph.js";
import {
  addVersionedResult,
  builtinAggregations,
  getAllVersions,
  getCurrentValue,
  installAggregation,
} from "../extensions/aggregation/index.js";

describe("Modular Aggregation System", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe("Core Helpers", () => {
    describe("addVersionedResult", () => {
      it("should add versioned result with refinement chain", () => {
        addVersionedResult(graph, "AGG1", 1, 100);
        addVersionedResult(graph, "AGG1", 2, 200);
        addVersionedResult(graph, "AGG1", 3, 250);

        // Check results exist
        const v1Results = graph.query(["AGG1", "AGG1:RESULT:V1", "?v"]);
        expect(v1Results.length).toBe(1);
        expect(v1Results[0].get("?v")).toBe(100);

        const v2Results = graph.query(["AGG1", "AGG1:RESULT:V2", "?v"]);
        expect(v2Results.length).toBe(1);
        expect(v2Results[0].get("?v")).toBe(200);

        const v3Results = graph.query(["AGG1", "AGG1:RESULT:V3", "?v"]);
        expect(v3Results.length).toBe(1);
        expect(v3Results[0].get("?v")).toBe(250);
      });

      it("should create REFINES edges between versions", () => {
        addVersionedResult(graph, "AGG1", 1, 100);
        addVersionedResult(graph, "AGG1", 2, 200);

        const refines = graph.query(["AGG1:RESULT:V2", "REFINES", "?prev"]);
        expect(refines.length).toBe(1);
        expect(refines[0].get("?prev")).toBe("AGG1:RESULT:V1");
      });

      it("should update version marker", () => {
        addVersionedResult(graph, "AGG1", 1, 100);
        addVersionedResult(graph, "AGG1", 2, 200);

        const versionResults = graph.query(["AGG1:VERSION", "CURRENT", "?v"]);
        expect(versionResults.length).toBeGreaterThan(0);

        // Get the latest version (should be 2)
        const versions = versionResults.map((b) => b.get("?v"));
        expect(versions).toContain(2);
      });

      it("should persist debug state when provided", () => {
        addVersionedResult(graph, "AGG1", 1, 100, { sum: 100, count: 1 });

        const sumResults = graph.query(["AGG1:STATE:V1", "sum", "?v"]);
        expect(sumResults.length).toBe(1);
        expect(sumResults[0].get("?v")).toBe(100);

        const countResults = graph.query(["AGG1:STATE:V1", "count", "?v"]);
        expect(countResults.length).toBe(1);
        expect(countResults[0].get("?v")).toBe(1);
      });
    });

    describe("getCurrentValue", () => {
      it("should return current (non-refined) value", () => {
        addVersionedResult(graph, "AGG1", 1, 100);
        addVersionedResult(graph, "AGG1", 2, 200);
        addVersionedResult(graph, "AGG1", 3, 250);

        const current = getCurrentValue(graph, "AGG1");
        expect(current).toBe(250);
      });

      it("should return null when no results exist", () => {
        const current = getCurrentValue(graph, "AGG1");
        expect(current).toBeNull();
      });

      it("should handle single version", () => {
        addVersionedResult(graph, "AGG1", 1, 100);

        const current = getCurrentValue(graph, "AGG1");
        expect(current).toBe(100);
      });
    });

    describe("getAllVersions", () => {
      it("should return all versions sorted by version number", () => {
        addVersionedResult(graph, "AGG1", 1, 100);
        addVersionedResult(graph, "AGG1", 2, 200);
        addVersionedResult(graph, "AGG1", 3, 250);

        const versions = getAllVersions(graph, "AGG1");
        expect(versions.length).toBe(3);
        expect(versions[0].version).toBe(1);
        expect(versions[0].value).toBe(100);
        expect(versions[0].isCurrent).toBe(false);
        expect(versions[1].version).toBe(2);
        expect(versions[1].value).toBe(200);
        expect(versions[1].isCurrent).toBe(false);
        expect(versions[2].version).toBe(3);
        expect(versions[2].value).toBe(250);
        expect(versions[2].isCurrent).toBe(true);
      });

      it("should return empty array when no versions exist", () => {
        const versions = getAllVersions(graph, "AGG1");
        expect(versions).toEqual([]);
      });
    });
  });

  describe("Built-in Aggregations", () => {
    beforeEach(() => {
      installAggregation(graph, builtinAggregations);
    });

    describe("SUM", () => {
      it("should sum numeric values", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);
        graph.add("AGG1", "ITEM", 30);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(60);
      });

      it("should parse string numbers", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", "10");
        graph.add("AGG1", "ITEM", "20");

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });

      it("should skip invalid values", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", "invalid");
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });

      it("should handle negative numbers", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", -5);
        graph.add("AGG1", "ITEM", 15);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(20);
      });
    });

    describe("COUNT", () => {
      it("should count all items", () => {
        graph.add("AGG1", "AGGREGATE", "COUNT");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);
        graph.add("AGG1", "ITEM", 30);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(3);
      });

      it("should count regardless of value", () => {
        graph.add("AGG1", "AGGREGATE", "COUNT");
        graph.add("AGG1", "ITEM", "hello");
        graph.add("AGG1", "ITEM", 42);
        graph.add("AGG1", "ITEM", null);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(3);
      });
    });

    describe("AVG", () => {
      it("should compute average of numeric values", () => {
        graph.add("AGG1", "AGGREGATE", "AVG");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);
        graph.add("AGG1", "ITEM", 30);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(20);
      });

      it("should skip invalid values", () => {
        graph.add("AGG1", "AGGREGATE", "AVG");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", "invalid");
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(15);
      });

      it("should return 0 for no valid values", () => {
        graph.add("AGG1", "AGGREGATE", "AVG");

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBeNull(); // No items yet
      });
    });

    describe("MIN", () => {
      it("should find minimum value", () => {
        graph.add("AGG1", "AGGREGATE", "MIN");
        graph.add("AGG1", "ITEM", 30);
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(10);
      });

      it("should handle negative numbers", () => {
        graph.add("AGG1", "AGGREGATE", "MIN");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", -5);
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(-5);
      });

      it("should skip invalid values", () => {
        graph.add("AGG1", "AGGREGATE", "MIN");
        graph.add("AGG1", "ITEM", 30);
        graph.add("AGG1", "ITEM", "invalid");
        graph.add("AGG1", "ITEM", 10);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(10);
      });

      it("should return null when no valid values", () => {
        graph.add("AGG1", "AGGREGATE", "MIN");

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBeNull();
      });
    });

    describe("MAX", () => {
      it("should find maximum value", () => {
        graph.add("AGG1", "AGGREGATE", "MAX");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 30);
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });

      it("should handle negative numbers", () => {
        graph.add("AGG1", "AGGREGATE", "MAX");
        graph.add("AGG1", "ITEM", -10);
        graph.add("AGG1", "ITEM", -5);
        graph.add("AGG1", "ITEM", -20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(-5);
      });

      it("should skip invalid values", () => {
        graph.add("AGG1", "AGGREGATE", "MAX");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", "invalid");
        graph.add("AGG1", "ITEM", 30);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });

      it("should return null when no valid values", () => {
        graph.add("AGG1", "AGGREGATE", "MAX");

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBeNull();
      });
    });

    describe("Operation Name Normalization", () => {
      it("should handle lowercase operation names", () => {
        graph.add("AGG1", "AGGREGATE", "sum");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });

      it("should handle mixed case operation names", () => {
        graph.add("AGG1", "AGGREGATE", "Sum");
        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);

        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });
    });

    describe("Multiple Independent Aggregations", () => {
      it("should handle multiple aggregations simultaneously", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG2", "AGGREGATE", "COUNT");
        graph.add("AGG3", "AGGREGATE", "MAX");

        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);

        graph.add("AGG2", "ITEM", "a");
        graph.add("AGG2", "ITEM", "b");
        graph.add("AGG2", "ITEM", "c");

        graph.add("AGG3", "ITEM", 5);
        graph.add("AGG3", "ITEM", 15);
        graph.add("AGG3", "ITEM", 10);

        expect(getCurrentValue(graph, "AGG1")).toBe(30);
        expect(getCurrentValue(graph, "AGG2")).toBe(3);
        expect(getCurrentValue(graph, "AGG3")).toBe(15);
      });
    });

    describe("Incremental Updates", () => {
      it("should incrementally update results as items are added", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");

        graph.add("AGG1", "ITEM", 10);
        expect(getCurrentValue(graph, "AGG1")).toBe(10);

        graph.add("AGG1", "ITEM", 20);
        expect(getCurrentValue(graph, "AGG1")).toBe(30);

        graph.add("AGG1", "ITEM", 15);
        expect(getCurrentValue(graph, "AGG1")).toBe(45);
      });

      it("should maintain version history", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");

        graph.add("AGG1", "ITEM", 10);
        graph.add("AGG1", "ITEM", 20);
        graph.add("AGG1", "ITEM", 15);

        const versions = getAllVersions(graph, "AGG1");
        expect(versions.length).toBe(3);
        expect(versions[0].value).toBe(10);
        expect(versions[1].value).toBe(30);
        expect(versions[2].value).toBe(45);
      });
    });

    describe("Cleanup", () => {
      it("should return cleanup function", () => {
        const cleanup = installAggregation(graph, builtinAggregations);
        expect(typeof cleanup).toBe("function");
      });

      it("should prevent duplicate watcher setup for same aggregation", () => {
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", 10);

        // Try to set up again (should be ignored)
        graph.add("AGG1", "AGGREGATE", "SUM");
        graph.add("AGG1", "ITEM", 20);

        // Should have correct result (not doubled)
        const result = getCurrentValue(graph, "AGG1");
        expect(result).toBe(30);
      });
    });
  });

  describe("Custom Aggregation Definitions", () => {
    it("should support custom aggregation operations", () => {
      const customAggregations = {
        PRODUCT: {
          initialState: { product: 1 },
          accumulate(state, rawValue) {
            const num = typeof rawValue === "number"
              ? rawValue
              : parseFloat(rawValue);
            if (isNaN(num)) return state;
            return { product: state.product * num };
          },
          reduce(state) {
            return state.product;
          },
        },
      };

      installAggregation(graph, customAggregations);

      graph.add("AGG1", "AGGREGATE", "PRODUCT");
      graph.add("AGG1", "ITEM", 2);
      graph.add("AGG1", "ITEM", 3);
      graph.add("AGG1", "ITEM", 4);

      const result = getCurrentValue(graph, "AGG1");
      expect(result).toBe(24);
    });

    it("should support aggregations with function-based initialState", () => {
      const customAggregations = {
        UNIQUE: {
          initialState: () => new Set(),
          accumulate(state, rawValue) {
            state.add(rawValue);
            return state;
          },
          reduce(state) {
            return state.size;
          },
        },
      };

      installAggregation(graph, customAggregations);

      graph.add("AGG1", "AGGREGATE", "UNIQUE");
      graph.add("AGG1", "ITEM", "a");
      graph.add("AGG1", "ITEM", "b");
      graph.add("AGG1", "ITEM", "a"); // Duplicate
      graph.add("AGG1", "ITEM", "c");

      const result = getCurrentValue(graph, "AGG1");
      expect(result).toBe(3); // Only counts unique values
    });
  });
});
