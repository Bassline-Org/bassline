/**
 * IO Contexts Prototype Tests
 *
 * Comparative tests: Old approach (current) vs New approach (IO contexts)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Graph } from "../src/minimal-graph.js";
import {
  installIOEffect,
  installIOEffects,
  getOutput,
  isHandled,
  getHandledContexts,
  getActiveEffects,
} from "../extensions/io-effects.js";
import {
  installIOCompute,
  installIOComputeOps,
  getComputeResult,
  isComputed,
  getComputedContexts,
  getActiveOperations,
} from "../extensions/io-compute.js";

// ============================================================================
// Mock Effect/Compute Definitions
// ============================================================================

const mockFetchEffect = {
  execute: async (graph, ctx) => {
    // Query context for URL
    const urlQ = graph.query([ctx, "URL", "?url", "*"]);
    if (urlQ.length === 0) throw new Error("Missing URL");

    const url = urlQ[0].get("?url");

    // Simulate fetch
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      RESULT: `Fetched: ${url}`,
      STATUS: "SUCCESS",
    };
  },
  doc: "Mock HTTP fetch effect",
};

const mockParseEffect = {
  execute: async (graph, ctx) => {
    // Query context for data to parse
    const dataQ = graph.query([ctx, "DATA", "?data", "*"]);
    if (dataQ.length === 0) throw new Error("Missing DATA");

    const data = dataQ[0].get("?data");

    return {
      PARSED: `Parsed: ${data}`,
      STATUS: "SUCCESS",
    };
  },
  doc: "Mock JSON parse effect",
};

const binaryOps = {
  ADD: {
    compute: (x, y) => x + y,
    doc: "Add two numbers",
  },
  MULTIPLY: {
    compute: (x, y) => x * y,
    doc: "Multiply two numbers",
  },
};

const unaryOps = {
  NEGATE: {
    compute: (x) => -x,
    doc: "Negate a number",
  },
};

// ============================================================================
// Tests: Basic Effect Execution
// ============================================================================

describe("IO Effects - Basic Execution", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it("should execute effect using IO pattern", async () => {
    // Install effect
    installIOEffect(graph, "FETCH", mockFetchEffect.execute, {
      doc: mockFetchEffect.doc,
    });

    // Create context with input data
    graph.add("req1", "URL", "http://example.com", null);

    // Request handling via input context
    graph.add("req1", "handle", "FETCH", "input");

    // Wait for async execution
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Verify output context has results
    expect(isHandled(graph, "FETCH", "req1")).toBe(true);
    expect(getOutput(graph, "req1", "RESULT")).toBe(
      "Fetched: http://example.com",
    );
    expect(getOutput(graph, "req1", "STATUS")).toBe("SUCCESS");
  });

  it("should handle errors gracefully", async () => {
    installIOEffect(graph, "FETCH", mockFetchEffect.execute);

    // Create context WITHOUT required URL
    graph.add("req2", "NOTURL", "wrong", null);
    graph.add("req2", "handle", "FETCH", "input");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(isHandled(graph, "FETCH", "req2")).toBe(true);
    expect(getOutput(graph, "req2", "ERROR")).toContain("Missing URL");
    expect(getOutput(graph, "req2", "STATUS")).toBe("ERROR");
  });

  it("should support multiple effects", async () => {
    installIOEffects(graph, {
      http: { FETCH: mockFetchEffect },
      parse: { PARSE: mockParseEffect },
    });

    // Execute FETCH
    graph.add("req1", "URL", "http://api.com", null);
    graph.add("req1", "handle", "FETCH", "input");

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Execute PARSE
    graph.add("req2", "DATA", '{"key":"value"}', null);
    graph.add("req2", "handle", "PARSE", "input");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getOutput(graph, "req1", "RESULT")).toContain("Fetched");
    expect(getOutput(graph, "req2", "PARSED")).toContain("Parsed");
  });
});

// ============================================================================
// Tests: Basic Compute Execution
// ============================================================================

describe("IO Compute - Basic Execution", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it("should execute binary operation using IO pattern", () => {
    installIOCompute(graph, "ADD", binaryOps.ADD.compute, {
      arity: "binary",
      doc: binaryOps.ADD.doc,
    });

    // Create context with operands
    graph.add("calc1", "X", 10, null);
    graph.add("calc1", "Y", 20, null);

    // Request computation
    graph.add("calc1", "handle", "ADD", "input");

    // Verify result
    expect(isComputed(graph, "ADD", "calc1")).toBe(true);
    expect(getComputeResult(graph, "calc1")).toBe(30);
  });

  it("should execute unary operation", () => {
    installIOCompute(graph, "NEGATE", unaryOps.NEGATE.compute, {
      arity: "unary",
      doc: unaryOps.NEGATE.doc,
    });

    graph.add("calc2", "VALUE", 42, null);
    graph.add("calc2", "handle", "NEGATE", "input");

    expect(getComputeResult(graph, "calc2")).toBe(-42);
  });

  it("should handle missing operands", () => {
    installIOCompute(graph, "MULTIPLY", binaryOps.MULTIPLY.compute, {
      arity: "binary",
    });

    // Missing Y operand
    graph.add("calc3", "X", 5, null);
    graph.add("calc3", "handle", "MULTIPLY", "input");

    expect(isComputed(graph, "MULTIPLY", "calc3")).toBe(true);
    expect(getOutput(graph, "calc3", "ERROR")).toContain("Missing operand");
    expect(getOutput(graph, "calc3", "STATUS")).toBe("ERROR");
  });

  it("should support multiple operations", () => {
    installIOComputeOps(graph, { binary: binaryOps, unary: unaryOps });

    // ADD
    graph.add("c1", "X", 10, null);
    graph.add("c1", "Y", 5, null);
    graph.add("c1", "handle", "ADD", "input");

    // MULTIPLY
    graph.add("c2", "X", 3, null);
    graph.add("c2", "Y", 7, null);
    graph.add("c2", "handle", "MULTIPLY", "input");

    // NEGATE
    graph.add("c3", "VALUE", 100, null);
    graph.add("c3", "handle", "NEGATE", "input");

    expect(getComputeResult(graph, "c1")).toBe(15);
    expect(getComputeResult(graph, "c2")).toBe(21);
    expect(getComputeResult(graph, "c3")).toBe(-100);
  });
});

// ============================================================================
// Tests: Introspection
// ============================================================================

describe("IO Contexts - Introspection", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it("should list all active effects", async () => {
    installIOEffects(graph, {
      http: { FETCH: mockFetchEffect },
      parse: { PARSE: mockParseEffect },
    });

    const effects = getActiveEffects(graph);
    expect(effects).toContain("FETCH");
    expect(effects).toContain("PARSE");
  });

  it("should list all active operations", () => {
    installIOComputeOps(graph, { binary: binaryOps });

    const ops = getActiveOperations(graph);
    expect(ops).toContain("ADD");
    expect(ops).toContain("MULTIPLY");
  });

  it("should find all contexts handled by effect", async () => {
    installIOEffect(graph, "FETCH", mockFetchEffect.execute);

    graph.add("req1", "URL", "http://a.com", null);
    graph.add("req1", "handle", "FETCH", "input");

    graph.add("req2", "URL", "http://b.com", null);
    graph.add("req2", "handle", "FETCH", "input");

    await new Promise((resolve) => setTimeout(resolve, 20));

    const handled = getHandledContexts(graph, "FETCH");
    expect(handled).toContain("req1");
    expect(handled).toContain("req2");
    expect(handled.length).toBe(2);
  });

  it("should find all contexts computed by operation", () => {
    installIOCompute(graph, "ADD", binaryOps.ADD.compute, { arity: "binary" });

    graph.add("c1", "X", 1, null);
    graph.add("c1", "Y", 2, null);
    graph.add("c1", "handle", "ADD", "input");

    graph.add("c2", "X", 3, null);
    graph.add("c2", "Y", 4, null);
    graph.add("c2", "handle", "ADD", "input");

    const computed = getComputedContexts(graph, "ADD");
    expect(computed).toContain("c1");
    expect(computed).toContain("c2");
    expect(computed.length).toBe(2);
  });

  it("should query effect metadata", () => {
    installIOEffect(graph, "FETCH", mockFetchEffect.execute, {
      category: "http",
      doc: "Fetch data from URL",
    });

    const typeQ = graph.query(["FETCH", "TYPE", "?t", "system"]);
    expect(typeQ[0].get("?t")).toBe("EFFECT");

    const catQ = graph.query(["FETCH", "CATEGORY", "?c", "system"]);
    expect(catQ[0].get("?c")).toBe("http");

    const docQ = graph.query(["FETCH", "DOCS", "?d", "system"]);
    expect(docQ[0].get("?d")).toBe("Fetch data from URL");
  });
});

// ============================================================================
// Tests: Chaining (Key benefit of IO pattern)
// ============================================================================

describe("IO Contexts - Chaining", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it("should chain effects by watching output context", async () => {
    installIOEffects(graph, {
      http: { FETCH: mockFetchEffect },
      parse: { PARSE: mockParseEffect },
    });

    // Chain: FETCH completes → trigger PARSE
    graph.watch([["FETCH", "handled", "?ctx", "output"]], (bindings) => {
      const ctx = bindings.get("?ctx");

      // Get FETCH result
      const fetchResult = getOutput(graph, ctx, "RESULT");

      // Create new context for PARSE with FETCH result as input
      const parseCtx = `${ctx}:parse`;
      graph.add(parseCtx, "DATA", fetchResult, null);
      graph.add(parseCtx, "handle", "PARSE", "input");
    });

    // Trigger chain by requesting FETCH
    graph.add("req1", "URL", "http://api.com/data", null);
    graph.add("req1", "handle", "FETCH", "input");

    // Wait for chain to complete
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Verify FETCH completed
    expect(isHandled(graph, "FETCH", "req1")).toBe(true);

    // Verify PARSE completed (chained)
    expect(isHandled(graph, "PARSE", "req1:parse")).toBe(true);
    expect(getOutput(graph, "req1:parse", "PARSED")).toContain("Parsed");
  });

  it("should chain compute operations", () => {
    installIOComputeOps(graph, { binary: binaryOps, unary: unaryOps });

    // Chain: ADD completes → trigger NEGATE
    graph.watch([["ADD", "handled", "?ctx", "output"]], (bindings) => {
      const ctx = bindings.get("?ctx");
      const result = getComputeResult(graph, ctx);

      // Create new context for NEGATE
      const negateCtx = `${ctx}:negate`;
      graph.add(negateCtx, "VALUE", result, null);
      graph.add(negateCtx, "handle", "NEGATE", "input");
    });

    // Trigger: 10 + 5 = 15, then -15
    graph.add("calc1", "X", 10, null);
    graph.add("calc1", "Y", 5, null);
    graph.add("calc1", "handle", "ADD", "input");

    // Verify chain completed
    expect(getComputeResult(graph, "calc1")).toBe(15);
    expect(getComputeResult(graph, "calc1:negate")).toBe(-15);
  });
});

// ============================================================================
// Tests: Comparison with Current Approach
// ============================================================================

describe("Comparison: Old vs New Approach", () => {
  it("OLD: Immediate activation on edge addition", () => {
    const graph = new Graph();
    let executed = false;

    // Old pattern: Watcher fires immediately
    graph.watch([
      ["?E", "EFFECT", "?NAME", "*"],
      ["?E", "INPUT", "?DATA", "*"],
    ], () => {
      executed = true;
    });

    graph.add("E1", "EFFECT", "FETCH", null);
    graph.add("E1", "INPUT", "http://...", null);

    // Executes immediately (same tick)
    expect(executed).toBe(true);
  });

  it("NEW: Explicit activation via input context", () => {
    const graph = new Graph();
    let executed = false;

    // New pattern: Watcher only fires on input context edge
    graph.watch([["?ctx", "handle", "FETCH", "input"]], () => {
      executed = true;
    });

    // Define data (doesn't trigger yet)
    graph.add("req1", "URL", "http://...", null);
    expect(executed).toBe(false);

    // Explicit activation
    graph.add("req1", "handle", "FETCH", "input");
    expect(executed).toBe(true);
  });

  it("NEW: Better introspection - can query pending work", () => {
    const graph = new Graph();

    // In new approach, can query what's waiting for handling
    graph.add("req1", "URL", "http://a.com", null);
    graph.add("req2", "URL", "http://b.com", null);

    // Not yet activated
    const pending = graph.query(["?ctx", "URL", "?url", "*"]);
    expect(pending.length).toBe(2);

    // Can query what's been handled
    graph.add("req1", "handle", "FETCH", "input");
    // (after execution)
    graph.add("FETCH", "handled", "req1", "output");

    const handled = graph.query(["FETCH", "handled", "?ctx", "output"]);
    expect(handled.length).toBe(1);
  });

  it("NEW: Compositional - effects/compute are just watchers", () => {
    const graph = new Graph();

    // Install using same pattern for both
    installIOEffect(graph, "FETCH", mockFetchEffect.execute);
    installIOCompute(graph, "ADD", binaryOps.ADD.compute, { arity: "binary" });

    // Both use identical request pattern
    graph.add("req1", "URL", "http://...", null);
    graph.add("req1", "handle", "FETCH", "input");

    graph.add("calc1", "X", 10, null);
    graph.add("calc1", "Y", 20, null);
    graph.add("calc1", "handle", "ADD", "input");

    // Uniform pattern across all IO operations
  });
});
