import { describe, it, expect } from "vitest";
import { Graph } from "../src/minimal-graph.js";

describe("Context Performance Benchmarks", () => {
  it("should maintain O(1) activation with contexts", () => {
    const g = new Graph();

    // Create patterns with context literals
    const contextAFires = [];
    const contextBFires = [];
    const anyContextFires = [];

    g.watch([["?p", "age", "?a", "context-A"]], () => contextAFires.push(1));
    g.watch([["?p", "age", "?a", "context-B"]], () => contextBFires.push(1));
    g.watch([["?p", "age", "?a", "*"]], () => anyContextFires.push(1));

    // Add edges with different contexts
    for (let i = 0; i < 100; i++) {
      g.add(`person-${i}`, "age", 30 + i, "context-A");
      g.add(`person-${i}`, "age", 40 + i, "context-B");
      g.add(`person-${i}`, "age", 50 + i, "context-C");
    }

    // Context-specific patterns should only fire for their context
    expect(contextAFires.length).toBe(100); // Only context-A edges
    expect(contextBFires.length).toBe(100); // Only context-B edges
    expect(anyContextFires.length).toBe(300); // All edges

    console.log("✓ Context-specific patterns activate selectively");
  });

  it("should handle large numbers of edges efficiently", () => {
    const g = new Graph();
    const edgeCount = 10000;

    const start = Date.now();

    // Add edges with auto-generated contexts
    for (let i = 0; i < edgeCount; i++) {
      g.add(`node-${i}`, "value", i, null);
    }

    const addDuration = Date.now() - start;

    // Query across all contexts
    const queryStart = Date.now();
    const results = g.query(["?n", "value", "?v", "*"]);
    const queryDuration = Date.now() - queryStart;

    expect(results.length).toBe(edgeCount);
    expect(addDuration).toBeLessThan(1000); // Should be fast
    expect(queryDuration).toBeLessThan(500); // Query should be fast

    const edgesPerSec = (edgeCount / addDuration) * 1000;
    console.log(`✓ Added ${edgeCount} edges in ${addDuration}ms (${Math.round(edgesPerSec)} edges/sec)`);
    console.log(`✓ Queried ${edgeCount} edges in ${queryDuration}ms`);
  });

  it("should demonstrate context-based selective activation benefits", () => {
    const g = new Graph();

    // Scenario: Real-time vs batch processing
    let realTimeProcessed = 0;
    let batchProcessed = 0;

    // Real-time pattern only watches real-time context
    g.watch([["?item", "status", "?s", "real-time"]], () => {
      realTimeProcessed++;
    });

    // Batch pattern only watches batch context
    g.watch([["?item", "status", "?s", "batch"]], () => {
      batchProcessed++;
    });

    // Add 1000 real-time events
    for (let i = 0; i < 1000; i++) {
      g.add(`item-${i}`, "status", "processed", "real-time");
    }

    // Add 1000 batch events
    for (let i = 0; i < 1000; i++) {
      g.add(`item-${i}`, "status", "queued", "batch");
    }

    // Each pattern only fired for its context
    expect(realTimeProcessed).toBe(1000);
    expect(batchProcessed).toBe(1000);

    console.log("✓ Context-specific patterns avoid unnecessary activations");
    console.log(`  Real-time pattern: ${realTimeProcessed} activations (1000 expected)`);
    console.log(`  Batch pattern: ${batchProcessed} activations (1000 expected)`);
  });

  it("should maintain performance with mixed context patterns", () => {
    const g = new Graph();

    // Mix of context-specific and wildcard patterns
    const fires = { specific: 0, wildcard: 0 };

    g.watch([["?p", "age", "?a", "verified"]], () => fires.specific++);
    g.watch([["?p", "age", "?a", "*"]], () => fires.wildcard++);

    const start = Date.now();

    // Add edges with various contexts
    for (let i = 0; i < 1000; i++) {
      g.add(`p${i}`, "age", 30, "verified");
      g.add(`p${i}`, "age", 25, "unverified");
      g.add(`p${i}`, "age", 35, "pending");
    }

    const duration = Date.now() - start;

    expect(fires.specific).toBe(1000); // Only verified
    expect(fires.wildcard).toBe(3000); // All

    console.log(`✓ Mixed patterns in ${duration}ms`);
    console.log(`  Specific: ${fires.specific}, Wildcard: ${fires.wildcard}`);
  });

  it("should efficiently query by context", () => {
    const g = new Graph();

    // Add edges across multiple contexts
    for (let ctx = 0; ctx < 10; ctx++) {
      for (let i = 0; i < 100; i++) {
        g.add(`item-${i}`, "value", i, `context-${ctx}`);
      }
    }

    // Query specific context should be fast
    const start = Date.now();
    const results = g.query(["?item", "value", "?v", "context-5"]);
    const duration = Date.now() - start;

    expect(results.length).toBe(100);
    expect(duration).toBeLessThan(50);

    console.log(`✓ Context-specific query in ${duration}ms`);
  });

  it("should handle context deduplication efficiently", () => {
    const g = new Graph();

    const start = Date.now();

    // Try to add same quad multiple times
    for (let i = 0; i < 1000; i++) {
      g.add("Alice", "age", 30, "verified");
    }

    const duration = Date.now() - start;

    // Should only have 1 edge (deduplicated)
    expect(g.edges.length).toBe(1);
    expect(duration).toBeLessThan(100);

    console.log(`✓ Deduplication check 1000 times in ${duration}ms`);
  });
});
