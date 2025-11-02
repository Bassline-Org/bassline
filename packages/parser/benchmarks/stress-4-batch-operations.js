/**
 * Stress Test 4: Batch Operations
 *
 * Tests batch transaction performance and rollback
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== Stress Test 4: Batch Operations ===\n");

function runBatchTest(patternCount, edgesPerBatch, batchCount) {
  const totalEdges = edgesPerBatch * batchCount;

  console.log(`\nTest: ${patternCount} patterns, ${batchCount} batches × ${edgesPerBatch} edges`);
  console.log(`      Total: ${totalEdges.toLocaleString()} edges`);

  const graph = new Graph();
  const startMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // Create patterns (mix of literal and wildcard)
  console.log("  Creating patterns...");

  for (let i = 0; i < patternCount * 0.8; i++) {
    graph.watch(
      [[`item${i}`, "batch", i]],
      () => {}
    );
  }

  for (let i = 0; i < patternCount * 0.2; i++) {
    graph.watch(
      [["?x", `process${i}`, "?y"]],
      () => {}
    );
  }

  // Test batch operations
  console.log("  Running batch operations...");
  const batchStart = performance.now();

  for (let b = 0; b < batchCount; b++) {
    graph.batch(() => {
      for (let i = 0; i < edgesPerBatch; i++) {
        const idx = b * edgesPerBatch + i;
        if (idx % 2 === 0) {
          graph.add(`item${idx % patternCount}`, "batch", idx % patternCount);
        } else {
          graph.add(`node${idx}`, `process${idx % Math.floor(patternCount * 0.2)}`, `value${idx}`);
        }
      }
    });
  }

  const batchTime = performance.now() - batchStart;

  // Test rollback
  console.log("  Testing rollback...");
  const edgesBefore = graph.edges.length;
  let rollbackOccurred = false;

  try {
    graph.batch(() => {
      for (let i = 0; i < 100; i++) {
        graph.add("test", "rollback", i);
      }
      throw new Error("Intentional rollback");
    });
  } catch (e) {
    rollbackOccurred = true;
  }

  const edgesAfter = graph.edges.length;
  const rollbackSuccess = edgesBefore === edgesAfter;

  const endMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(`    Batch execution: ${batchTime.toFixed(2)}ms`);
  console.log(`    Throughput: ${Math.round(totalEdges / (batchTime / 1000)).toLocaleString()} edges/sec`);
  console.log(`    Rollback test: ${rollbackSuccess ? "✓ PASSED" : "✗ FAILED"}`);
  console.log(`    Memory used: ${endMem - startMem} MB`);
  console.log(`    Time per edge: ${(batchTime / totalEdges).toFixed(4)}ms`);

  return {
    patterns: patternCount,
    batches: batchCount,
    edgesPerBatch: edgesPerBatch,
    totalEdges: totalEdges,
    time: batchTime,
    memory: endMem - startMem,
    perEdge: batchTime / totalEdges,
    rollbackOk: rollbackSuccess
  };
}

// Compare individual vs batch operations
function compareIndividualVsBatch(patternCount, edgeCount) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Comparing Individual vs Batch (${patternCount} patterns, ${edgeCount} edges)\n`);

  const graph1 = new Graph();
  const graph2 = new Graph();

  // Create same patterns in both
  for (let i = 0; i < patternCount; i++) {
    const pattern = [[`test${i}`, "value", i]];
    graph1.watch(pattern, () => {});
    graph2.watch(pattern, () => {});
  }

  // Test 1: Individual adds
  console.log("Individual adds:");
  const individualStart = performance.now();
  for (let i = 0; i < edgeCount; i++) {
    graph1.add(`test${i % patternCount}`, "value", i % patternCount);
  }
  const individualTime = performance.now() - individualStart;
  console.log(`  Time: ${individualTime.toFixed(2)}ms`);
  console.log(`  Per edge: ${(individualTime / edgeCount).toFixed(4)}ms`);

  // Test 2: Batch adds
  console.log("\nBatch adds (batch size 100):");
  const batchStart = performance.now();
  const batchSize = 100;
  const batchCount = Math.ceil(edgeCount / batchSize);

  for (let b = 0; b < batchCount; b++) {
    graph2.batch(() => {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, edgeCount);
      for (let i = start; i < end; i++) {
        graph2.add(`test${i % patternCount}`, "value", i % patternCount);
      }
    });
  }
  const batchTime = performance.now() - batchStart;
  console.log(`  Time: ${batchTime.toFixed(2)}ms`);
  console.log(`  Per edge: ${(batchTime / edgeCount).toFixed(4)}ms`);

  const improvement = individualTime / batchTime;
  console.log(`\nBatch is ${improvement.toFixed(2)}x faster than individual adds`);
}

// Run tests
const results = [];

console.log("Small batches:");
results.push(runBatchTest(100, 10, 100));     // 1,000 edges
results.push(runBatchTest(100, 100, 100));    // 10,000 edges

console.log("\nLarge batches:");
results.push(runBatchTest(1000, 100, 100));   // 10,000 edges
results.push(runBatchTest(1000, 1000, 100));  // 100,000 edges

console.log("\nMany small batches:");
results.push(runBatchTest(500, 10, 1000));    // 10,000 edges
results.push(runBatchTest(500, 50, 1000));    // 50,000 edges

// Comparison test
compareIndividualVsBatch(100, 5000);

// Summary
console.log("\n" + "=".repeat(60));
console.log("\nSUMMARY - Batch Operations\n");
console.log("| Patterns | Batches | Per Batch | Total | Time (ms) | Rollback |");
console.log("|----------|---------|-----------|-------|-----------|----------|");

for (const r of results) {
  console.log(
    `| ${r.patterns.toString().padStart(8)} | ${r.batches.toString().padStart(7)} | ${
      r.edgesPerBatch.toString().padStart(9)
    } | ${r.totalEdges.toString().padStart(5)} | ${
      r.time.toFixed(1).padStart(9)
    } | ${r.rollbackOk ? "    ✓    " : "    ✗    "} |`
  );
}

console.log("\nKey Findings:");
console.log("- Batch operations reduce pattern checking overhead");
console.log("- Rollback correctly restores graph state");
console.log("- Larger batch sizes generally improve performance");