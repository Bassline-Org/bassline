/**
 * Stress Test 2: Wildcard Pattern Performance
 *
 * Tests performance with patterns containing variables/wildcards
 * These patterns must check every edge (no indexing benefit)
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== Stress Test 2: Wildcard Pattern Scaling ===\n");

function runTest(patternCount, edgeCount) {
  console.log(`\nTest: ${patternCount.toLocaleString()} wildcard patterns, ${edgeCount.toLocaleString()} edges`);

  const graph = new Graph();
  const startMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // Create wildcard patterns (these can't use indexing)
  console.log("  Creating wildcard patterns...");
  const patternStart = performance.now();

  for (let i = 0; i < patternCount; i++) {
    graph.watch(
      [["?source", `attr${i}`, "?target"]],
      () => {} // Empty callback
    );
  }

  const patternTime = performance.now() - patternStart;
  console.log(`    Pattern creation: ${patternTime.toFixed(2)}ms`);
  console.log(`    Wildcard patterns: ${graph.wildcardPatterns.size}`);
  console.log(`    Indexed patterns: ${graph.sourceIndex.size} (should be 0)`);

  // Add edges
  console.log("  Adding edges...");
  const edgeStart = performance.now();

  for (let i = 0; i < edgeCount; i++) {
    // Mix of attributes, some match patterns, some don't
    const attr = `attr${i % (patternCount * 2)}`;
    graph.add(`node${i}`, attr, `value${i}`);
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
results.push(runTest(500, 5000));

console.log("\nMedium scale tests:");
results.push(runTest(1000, 10000));
results.push(runTest(2000, 20000));

// Note: Wildcard patterns are expensive, so we test with smaller counts
console.log("\nLarge scale test:");
results.push(runTest(5000, 50000));

// Summary
console.log("\n" + "=".repeat(60));
console.log("\nSUMMARY - Wildcard Pattern Scaling\n");
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
console.log("- Time per edge increases linearly with pattern count");
console.log("- This is expected: wildcards must check every pattern");
console.log("- Shows O(P) behavior for wildcard patterns");

// Calculate scaling factor
if (results.length >= 2) {
  const first = results[0];
  const last = results[results.length - 1];
  const scalingFactor = (last.perEdge / first.perEdge) / (last.patterns / first.patterns);
  console.log(`- Scaling factor: ${scalingFactor.toFixed(2)}x (should be ~1.0 for linear)`);
}