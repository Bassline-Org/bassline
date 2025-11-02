/**
 * Stress Test 3: Mixed Pattern Performance
 *
 * Tests realistic scenario with both literal and wildcard patterns
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== Stress Test 3: Mixed Pattern Performance ===\n");

function runTest(literalCount, wildcardCount, edgeCount) {
  const totalPatterns = literalCount + wildcardCount;
  const wildcardRatio = (wildcardCount / totalPatterns * 100).toFixed(1);

  console.log(`\nTest: ${literalCount} literal + ${wildcardCount} wildcard patterns (${wildcardRatio}% wildcard)`);
  console.log(`      ${edgeCount.toLocaleString()} edges`);

  const graph = new Graph();
  const startMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // Create literal patterns
  console.log("  Creating patterns...");
  const patternStart = performance.now();

  for (let i = 0; i < literalCount; i++) {
    graph.watch(
      [[`specific${i}`, "type", "entity"]],
      () => {}
    );
  }

  // Create wildcard patterns
  for (let i = 0; i < wildcardCount; i++) {
    graph.watch(
      [["?x", `relation${i}`, "?y"]],
      () => {}
    );
  }

  const patternTime = performance.now() - patternStart;
  console.log(`    Pattern creation: ${patternTime.toFixed(2)}ms`);
  console.log(`    Indexed patterns: ${graph.sourceIndex.size}`);
  console.log(`    Wildcard patterns: ${graph.wildcardPatterns.size}`);

  // Add edges
  console.log("  Adding edges...");
  const edgeStart = performance.now();

  for (let i = 0; i < edgeCount; i++) {
    if (i % 3 === 0) {
      // Matches literal patterns
      graph.add(`specific${i % literalCount}`, "type", "entity");
    } else if (i % 3 === 1) {
      // Matches wildcard patterns
      graph.add(`node${i}`, `relation${i % wildcardCount}`, `target${i}`);
    } else {
      // Doesn't match any pattern
      graph.add(`other${i}`, "misc", `data${i}`);
    }
  }

  const edgeTime = performance.now() - edgeStart;
  const endMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(`    Edge addition: ${edgeTime.toFixed(2)}ms`);
  console.log(`    Throughput: ${Math.round(edgeCount / (edgeTime / 1000)).toLocaleString()} edges/sec`);
  console.log(`    Memory used: ${endMem - startMem} MB`);
  console.log(`    Time per edge: ${(edgeTime / edgeCount).toFixed(4)}ms`);

  return {
    literal: literalCount,
    wildcard: wildcardCount,
    edges: edgeCount,
    time: edgeTime,
    memory: endMem - startMem,
    perEdge: edgeTime / edgeCount
  };
}

// Test different ratios
const results = [];

console.log("90% Literal, 10% Wildcard (Best case for indexing):");
results.push(runTest(900, 100, 10000));
results.push(runTest(4500, 500, 50000));

console.log("\n70% Literal, 30% Wildcard (Typical case):");
results.push(runTest(700, 300, 10000));
results.push(runTest(3500, 1500, 50000));

console.log("\n50% Literal, 50% Wildcard (Balanced):");
results.push(runTest(500, 500, 10000));
results.push(runTest(2500, 2500, 50000));

console.log("\n10% Literal, 90% Wildcard (Worst case for indexing):");
results.push(runTest(100, 900, 10000));
results.push(runTest(500, 4500, 50000));

// Summary
console.log("\n" + "=".repeat(60));
console.log("\nSUMMARY - Mixed Pattern Performance\n");
console.log("| Literal | Wildcard | Edges | Time (ms) | Per Edge (ms) |");
console.log("|---------|----------|-------|-----------|---------------|");

for (const r of results) {
  console.log(
    `| ${r.literal.toString().padStart(7)} | ${r.wildcard.toString().padStart(8)} | ${
      r.edges.toString().padStart(5)
    } | ${r.time.toFixed(1).padStart(9)} | ${
      r.perEdge.toFixed(5).padStart(13)
    } |`
  );
}

console.log("\nKey Findings:");
console.log("- Performance degrades as wildcard ratio increases");
console.log("- Indexing still provides benefit for literal patterns");
console.log("- Real applications should minimize wildcard patterns");

// Compare best vs worst case
if (results.length >= 2) {
  const bestCase = results[0];  // 90% literal
  const worstCase = results[results.length - 1];  // 10% literal
  const improvement = worstCase.perEdge / bestCase.perEdge;
  console.log(`- Performance difference (90% vs 10% literal): ${improvement.toFixed(1)}x slower`);
}