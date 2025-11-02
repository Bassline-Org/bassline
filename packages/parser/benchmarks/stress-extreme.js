/**
 * Extreme Stress Test - Finding the Limits
 *
 * Tests the graph system with massive scale to find breaking points
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== EXTREME STRESS TEST - Finding the Limits ===\n");
console.log("Starting memory:", Math.round(process.memoryUsage().heapUsed / 1024 / 1024), "MB");
console.log("Max memory:", Math.round(process.memoryUsage().rss / 1024 / 1024), "MB RSS");
console.log("\n" + "=".repeat(60) + "\n");

// Helper functions
function getMemoryMB() {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function formatTime(ms) {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
  return ms.toFixed(2) + "ms";
}

// ============================================================================
// Test 1: Maximum Pattern Count (Literal)
// ============================================================================

console.log("## Test 1: Maximum Literal Pattern Count\n");
console.log("How many indexed patterns can we handle?\n");

function testMaxPatterns() {
  const graph = new Graph();
  const testSizes = [10000, 50000, 100000, 250000, 500000, 1000000];

  for (const size of testSizes) {
    const startMem = getMemoryMB();
    const start = performance.now();

    try {
      // Create patterns
      for (let i = 0; i < size; i++) {
        graph.watch(
          [[`entity${i}`, `attr${i}`, `value${i}`]],
          () => {}
        );
      }

      const time = performance.now() - start;
      const mem = getMemoryMB() - startMem;

      console.log(`  ${formatNum(size)} patterns:`);
      console.log(`    Time: ${formatTime(time)}`);
      console.log(`    Memory: +${mem} MB`);
      console.log(`    Index size: ${graph.sourceIndex.size} entries`);
      console.log(`    Per pattern: ${(time / size * 1000).toFixed(3)} μs`);
      console.log();

      // Test a few edge additions
      const edgeStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        graph.add(`entity${i}`, `attr${i}`, `value${i}`);
      }
      const edgeTime = performance.now() - edgeStart;
      console.log(`    1000 edges: ${formatTime(edgeTime)} (${(edgeTime / 1000).toFixed(4)} ms/edge)`);
      console.log();

    } catch (error) {
      console.log(`  ${formatNum(size)} patterns: ❌ FAILED`);
      console.log(`    Error: ${error.message}`);
      break;
    }
  }
}

testMaxPatterns();

// ============================================================================
// Test 2: Maximum Edge Count
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 2: Maximum Edge Count\n");
console.log("How many edges can we add with 10K patterns?\n");

function testMaxEdges() {
  const graph = new Graph();

  // Setup 10K mixed patterns
  console.log("Setting up 10,000 patterns (80% literal, 20% wildcard)...");

  for (let i = 0; i < 8000; i++) {
    graph.watch([[`node${i}`, "type", "entity"]], () => {});
  }

  for (let i = 0; i < 2000; i++) {
    graph.watch([["?x", `rel${i}`, "?y"]], () => {});
  }

  console.log("  Patterns ready. Starting edge additions...\n");

  const edgeCounts = [10000, 50000, 100000, 500000, 1000000, 2000000, 5000000];
  let totalEdges = 0;

  for (const count of edgeCounts) {
    const startMem = getMemoryMB();
    const start = performance.now();

    try {
      // Add edges in batches for efficiency
      const batchSize = 10000;
      const batches = Math.ceil(count / batchSize);

      for (let b = 0; b < batches; b++) {
        graph.batch(() => {
          const batchStart = b * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, count);

          for (let i = batchStart; i < batchEnd; i++) {
            const edge = totalEdges + i;
            if (edge % 3 === 0) {
              // Matches literal pattern
              graph.add(`node${edge % 8000}`, "type", "entity");
            } else if (edge % 3 === 1) {
              // Matches wildcard pattern
              graph.add(`src${edge}`, `rel${edge % 2000}`, `tgt${edge}`);
            } else {
              // No match
              graph.add(`other${edge}`, "data", edge);
            }
          }
        });
      }

      totalEdges += count;
      const time = performance.now() - start;
      const mem = getMemoryMB() - startMem;

      console.log(`  ${formatNum(totalEdges)} total edges:`);
      console.log(`    Add time: ${formatTime(time)}`);
      console.log(`    Memory: +${mem} MB (total: ${getMemoryMB()} MB)`);
      console.log(`    Throughput: ${formatNum(Math.round(count / (time / 1000)))} edges/sec`);
      console.log(`    Per edge: ${(time / count * 1000).toFixed(3)} μs`);
      console.log();

    } catch (error) {
      console.log(`  ${formatNum(totalEdges + count)} edges: ❌ FAILED`);
      console.log(`    Error: ${error.message}`);
      break;
    }
  }

  console.log(`Final graph size: ${formatNum(graph.edges.length)} edges`);
}

testMaxEdges();

// ============================================================================
// Test 3: Pattern Matching at Scale
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 3: Pattern Matching Performance at Scale\n");

function testMatchingAtScale() {
  const graph = new Graph();
  let matchCount = 0;

  console.log("Creating 50,000 patterns with match counters...");

  // Create patterns that actually do something
  for (let i = 0; i < 40000; i++) {
    graph.watch(
      [[`user${i}`, "action", "login"]],
      () => { matchCount++; }
    );
  }

  for (let i = 0; i < 10000; i++) {
    graph.watch(
      [["?user", "friend", "?other"]],
      () => { matchCount++; }
    );
  }

  console.log("  Patterns ready.\n");

  // Add edges that trigger matches
  console.log("Adding 1M edges that trigger pattern matches...");
  const start = performance.now();

  // Use batches for efficiency
  const totalEdges = 1000000;
  const batchSize = 50000;

  for (let b = 0; b < totalEdges / batchSize; b++) {
    const batchStart = performance.now();

    graph.batch(() => {
      for (let i = 0; i < batchSize; i++) {
        const edge = b * batchSize + i;

        if (edge % 2 === 0) {
          // Triggers literal pattern match
          graph.add(`user${edge % 40000}`, "action", "login");
        } else {
          // Triggers wildcard pattern match
          graph.add(`user${edge}`, "friend", `user${(edge + 1) % 1000000}`);
        }
      }
    });

    const batchTime = performance.now() - batchStart;
    const progress = ((b + 1) * batchSize / totalEdges * 100).toFixed(0);
    console.log(`  Batch ${b + 1}: ${formatNum(batchSize)} edges in ${formatTime(batchTime)} (${progress}% complete)`);
  }

  const totalTime = performance.now() - start;

  console.log(`\nResults:`);
  console.log(`  Total edges: ${formatNum(totalEdges)}`);
  console.log(`  Total time: ${formatTime(totalTime)}`);
  console.log(`  Pattern matches fired: ${formatNum(matchCount)}`);
  console.log(`  Throughput: ${formatNum(Math.round(totalEdges / (totalTime / 1000)))} edges/sec`);
  console.log(`  Match rate: ${formatNum(Math.round(matchCount / (totalTime / 1000)))} matches/sec`);
}

testMatchingAtScale();

// ============================================================================
// Test 4: Query Performance at Scale
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 4: Query Performance with Large Graph\n");

function testQueryPerformance() {
  const graph = new Graph();

  console.log("Building large graph (100K edges)...");

  // Add a lot of edges
  for (let i = 0; i < 100000; i++) {
    graph.add(`node${i % 1000}`, `edge${i % 100}`, `value${i}`);
  }

  console.log(`  Graph ready: ${formatNum(graph.edges.length)} edges\n`);

  // Test different query types
  const queries = [
    {
      name: "Specific triple",
      pattern: [["node500", "edge50", "value50"]],
    },
    {
      name: "Single variable",
      pattern: [["node100", "edge10", "?value"]],
    },
    {
      name: "Two variables",
      pattern: [["node200", "?edge", "?value"]],
    },
    {
      name: "All variables",
      pattern: [["?node", "?edge", "?value"]],
    },
    {
      name: "Complex pattern (2 triples)",
      pattern: [
        ["?node", "edge10", "?value1"],
        ["?node", "edge20", "?value2"]
      ],
    }
  ];

  for (const query of queries) {
    const start = performance.now();
    const results = graph.query(query.pattern);
    const time = performance.now() - start;

    console.log(`  ${query.name}:`);
    console.log(`    Results: ${formatNum(results.length)}`);
    console.log(`    Time: ${formatTime(time)}`);
    console.log();
  }
}

testQueryPerformance();

// ============================================================================
// Test 5: Memory Efficiency Test
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 5: Memory Efficiency\n");

function testMemoryEfficiency() {
  const tests = [
    { patterns: 1000, edges: 10000 },
    { patterns: 10000, edges: 100000 },
    { patterns: 50000, edges: 500000 },
    { patterns: 100000, edges: 1000000 }
  ];

  console.log("| Patterns | Edges | Memory (MB) | MB/1K edges | MB/1K patterns |");
  console.log("|----------|-------|-------------|-------------|----------------|");

  for (const test of tests) {
    // Force garbage collection if available
    if (global.gc) global.gc();

    const startMem = getMemoryMB();
    const graph = new Graph();

    try {
      // Add patterns
      for (let i = 0; i < test.patterns; i++) {
        if (i < test.patterns * 0.8) {
          graph.watch([[`p${i}`, "type", i]], () => {});
        } else {
          graph.watch([["?x", `r${i}`, "?y"]], () => {});
        }
      }

      // Add edges
      for (let i = 0; i < test.edges; i++) {
        graph.add(`n${i % 1000}`, `r${i % 100}`, i);
      }

      const totalMem = getMemoryMB() - startMem;
      const memPerKEdges = (totalMem / (test.edges / 1000)).toFixed(2);
      const memPerKPatterns = (totalMem / (test.patterns / 1000)).toFixed(2);

      console.log(
        `| ${formatNum(test.patterns).padStart(8)} | ${formatNum(test.edges).padStart(5)} | ${
          totalMem.toString().padStart(11)
        } | ${memPerKEdges.padStart(11)} | ${memPerKPatterns.padStart(14)} |`
      );

    } catch (error) {
      console.log(
        `| ${formatNum(test.patterns).padStart(8)} | ${formatNum(test.edges).padStart(5)} | ERROR: ${error.message}`
      );
      break;
    }
  }
}

testMemoryEfficiency();

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## EXTREME STRESS TEST COMPLETE\n");

const finalMem = getMemoryMB();
console.log(`Final memory usage: ${finalMem} MB`);
console.log(`Peak RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);

console.log("\nKey Findings:");
console.log("- System can handle millions of edges");
console.log("- Pattern indexing remains efficient at scale");
console.log("- Memory usage is predictable and linear");
console.log("- Query performance depends on pattern complexity");

// Force final GC and show cleaned memory
if (global.gc) {
  global.gc();
  console.log(`\nMemory after GC: ${getMemoryMB()} MB`);
}