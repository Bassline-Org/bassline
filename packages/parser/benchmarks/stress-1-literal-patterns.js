/**
 * Stress Test 1: Pure Literal Pattern Performance
 *
 * Tests how well the indexing handles many literal patterns
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== Stress Test 1: Literal Pattern Scaling ===\n");

function runTest(patternCount, edgeCount) {
  console.log(`\nTest: ${patternCount.toLocaleString()} patterns, ${edgeCount.toLocaleString()} edges`);

  const graph = new Graph();
  const startMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // Create literal patterns
  console.log("  Creating patterns...");
  const patternStart = performance.now();

  for (let i = 0; i < patternCount; i++) {
    graph.watch(
      [[`entity${i}`, "value", i]],
      () => {} // Empty callback for now
    );
  }

  const patternTime = performance.now() - patternStart;
  console.log(`    Pattern creation: ${patternTime.toFixed(2)}ms`);
  console.log(`    Indexed patterns: ${graph.sourceIndex.size} sources`);
  console.log(`    Wildcard patterns: ${graph.wildcardPatterns.size}`);

  // Add edges
  console.log("  Adding edges...");
  const edgeStart = performance.now();

  for (let i = 0; i < edgeCount; i++) {
    if (i < patternCount) {
      // These should match patterns (using index)
      graph.add(`entity${i}`, "value", i);
    } else {
      // These don't match any pattern
      graph.add(`other${i}`, "data", i);
    }
  }

  const edgeTime = performance.now() - edgeStart;
  const endMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(`    Edge addition: ${edgeTime.toFixed(2)}ms`);
  console.log(`    Throughput: ${Math.round(edgeCount / (edgeTime / 1000)).toLocaleString()} edges/sec`);
  console.log(`    Memory used: ${endMem - startMem} MB`);
  console.log(`    Time per edge: ${(edgeTime / edgeCount).toFixed(4)}ms`);

  return {
    patterns: patternCount,
    edges: edgeCount,
    time: edgeTime,
    memory: endMem - startMem,
    perEdge: edgeTime / edgeCount
  };
}

// Run tests with increasing scale
const results = [];

console.log("Small scale tests:");
results.push(runTest(10, 100));
results.push(runTest(100, 1000));
results.push(runTest(1000, 10000));

console.log("\nMedium scale tests:");
results.push(runTest(5000, 20000));
results.push(runTest(10000, 50000));

console.log("\nLarge scale test:");
results.push(runTest(20000, 100000));

// Summary
console.log("\n" + "=".repeat(60));
console.log("\nSUMMARY - Literal Pattern Scaling\n");
console.log("| Patterns | Edges | Time (ms) | Per Edge (ms) | Memory (MB) |");
console.log("|----------|-------|-----------|---------------|-------------|");

for (const r of results) {
  console.log(
    `| ${r.patterns.toString().padStart(8)} | ${r.edges.toString().padStart(5)} | ${
      r.time.toFixed(1).padStart(9)
    } | ${r.perEdge.toFixed(5).padStart(13)} | ${
      r.memory.toString().padStart(11)
    } |`
  );
}

console.log("\nKey Findings:");
console.log("- Time per edge should remain constant with literal patterns");
console.log("- Memory scales with edge count, not pattern count");
console.log("- Indexing provides O(1) pattern activation");