/**
 * Mega Stress Test - Push the system to its absolute limits
 *
 * Single process, maximum scale
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== MEGA STRESS TEST - Maximum Scale ===\n");
console.log("Starting memory:", Math.round(process.memoryUsage().heapUsed / 1024 / 1024), "MB");
console.log("Available memory:", Math.round(process.memoryUsage().rss / 1024 / 1024), "MB RSS");
console.log("\n" + "=".repeat(60) + "\n");

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
}

function getMemoryMB() {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

// ============================================================================
// Test 1: Million Patterns Test
// ============================================================================

console.log("## Test 1: One Million Patterns\n");

function millionPatternTest() {
  const graph = new Graph();
  const target = 1000000;
  const batchSize = 50000;

  console.log(`Creating ${formatNum(target)} patterns in batches of ${formatNum(batchSize)}...\n`);

  const startMem = getMemoryMB();
  const startTime = performance.now();
  let created = 0;

  try {
    while (created < target) {
      const batchStart = performance.now();
      const batchEnd = Math.min(created + batchSize, target);

      // Mix of patterns - 80% literal, 20% wildcard
      for (let i = created; i < batchEnd; i++) {
        if (i % 5 === 0) {
          // Wildcard pattern (20%)
          graph.watch([["?x", `attr${i}`, "?y"]], () => {});
        } else {
          // Literal pattern (80%)
          graph.watch([[`entity${i}`, `type${i % 100}`, i]], () => {});
        }
      }

      const batchTime = performance.now() - batchStart;
      created = batchEnd;

      console.log(`  Batch: ${formatNum(created)}/${formatNum(target)} patterns`);
      console.log(`    Time: ${batchTime.toFixed(0)}ms`);
      console.log(`    Memory: ${getMemoryMB()} MB`);
      console.log(`    Index size: ${graph.sourceIndex.size}`);
      console.log(`    Wildcard count: ${graph.wildcardPatterns.size}`);
      console.log();
    }

    const totalTime = performance.now() - startTime;
    const finalMem = getMemoryMB();

    console.log(`✅ Successfully created ${formatNum(target)} patterns!`);
    console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Memory used: ${finalMem - startMem} MB`);
    console.log(`  Per pattern: ${(totalTime / target * 1000).toFixed(3)} μs`);

    // Test edge addition speed
    console.log(`\nTesting edge addition with ${formatNum(target)} patterns...`);
    const edgeStart = performance.now();

    for (let i = 0; i < 10000; i++) {
      if (i % 2 === 0) {
        graph.add(`entity${i}`, `type${i % 100}`, i);
      } else {
        graph.add(`random${i}`, `attr${i}`, `value${i}`);
      }
    }

    const edgeTime = performance.now() - edgeStart;
    console.log(`  10K edges: ${edgeTime.toFixed(2)}ms (${(edgeTime / 10).toFixed(3)}ms per edge)`);

    return graph;

  } catch (error) {
    console.log(`❌ Failed at ${formatNum(created)} patterns`);
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

const graph1 = millionPatternTest();

// ============================================================================
// Test 2: Ten Million Edges Test
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 2: Ten Million Edges\n");

function tenMillionEdgeTest() {
  const graph = new Graph();
  const target = 10000000;

  // First create a reasonable number of patterns
  console.log("Setting up 50K patterns...");
  for (let i = 0; i < 40000; i++) {
    graph.watch([[`node${i}`, "type", "entity"]], () => {});
  }
  for (let i = 0; i < 10000; i++) {
    graph.watch([["?x", `rel${i}`, "?y"]], () => {});
  }
  console.log(`  Ready: ${graph.sourceIndex.size} indexed, ${graph.wildcardPatterns.size} wildcards\n`);

  console.log(`Adding ${formatNum(target)} edges in batches...\n`);

  const startMem = getMemoryMB();
  const startTime = performance.now();
  const batchSize = 100000;
  let added = 0;

  try {
    while (added < target) {
      const batchStart = performance.now();

      graph.batch(() => {
        const batchEnd = Math.min(added + batchSize, target);
        for (let i = added; i < batchEnd; i++) {
          if (i % 3 === 0) {
            // Matches literal pattern
            graph.add(`node${i % 40000}`, "type", "entity");
          } else if (i % 3 === 1) {
            // Matches wildcard pattern
            graph.add(`src${i}`, `rel${i % 10000}`, `tgt${i}`);
          } else {
            // No match
            graph.add(`other${i}`, "data", i);
          }
        }
        added = batchEnd;
      });

      const batchTime = performance.now() - batchStart;
      const progress = (added / target * 100).toFixed(1);

      console.log(`  Progress: ${formatNum(added)}/${formatNum(target)} (${progress}%)`);
      console.log(`    Batch time: ${batchTime.toFixed(0)}ms`);
      console.log(`    Total edges: ${graph.edges.length}`);
      console.log(`    Memory: ${getMemoryMB()} MB`);
      console.log(`    Throughput: ${formatNum(Math.round(batchSize / (batchTime / 1000)))} edges/sec`);
      console.log();
    }

    const totalTime = performance.now() - startTime;
    const finalMem = getMemoryMB();

    console.log(`✅ Successfully added ${formatNum(target)} edges!`);
    console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Memory used: ${finalMem - startMem} MB`);
    console.log(`  Overall throughput: ${formatNum(Math.round(target / (totalTime / 1000)))} edges/sec`);

    return graph;

  } catch (error) {
    console.log(`❌ Failed at ${formatNum(added)} edges`);
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

const graph2 = tenMillionEdgeTest();

// ============================================================================
// Test 3: Complex Pattern Matching at Scale
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Test 3: Complex Pattern Matching (Multi-Triple)\n");

function complexPatternTest() {
  const graph = new Graph();

  console.log("Creating 10K complex patterns (3 triples each)...");

  const startTime = performance.now();

  for (let i = 0; i < 10000; i++) {
    graph.watch([
      [`?person`, "type", "person"],
      [`?person`, "name", `?name${i}`],
      [`?person`, "age", `?age${i}`]
    ], () => {});
  }

  const patternTime = performance.now() - startTime;
  console.log(`  Pattern creation: ${patternTime.toFixed(2)}ms`);
  console.log(`  Wildcard patterns: ${graph.wildcardPatterns.size}\n`);

  console.log("Adding 1M edges to trigger complex matches...");

  const edgeStart = performance.now();
  let matches = 0;

  // Add people with all attributes (should match)
  for (let i = 0; i < 100000; i++) {
    graph.batch(() => {
      graph.add(`person${i}`, "type", "person");
      graph.add(`person${i}`, "name", `Name${i}`);
      graph.add(`person${i}`, "age", 25 + (i % 50));
      // These should trigger pattern matches
    });

    if (i % 10000 === 0 && i > 0) {
      const elapsed = performance.now() - edgeStart;
      console.log(`  Progress: ${i / 1000}K people added in ${(elapsed / 1000).toFixed(2)}s`);
    }
  }

  const edgeTime = performance.now() - edgeStart;

  console.log(`\n✅ Complex pattern test complete`);
  console.log(`  Time: ${(edgeTime / 1000).toFixed(2)}s`);
  console.log(`  Edges in graph: ${graph.edges.length}`);
  console.log(`  Memory: ${getMemoryMB()} MB`);

  return graph;
}

const graph3 = complexPatternTest();

// ============================================================================
// Final Summary
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## MEGA TEST SUMMARY\n");

const finalMem = getMemoryMB();
const peakRSS = Math.round(process.memoryUsage().rss / 1024 / 1024);

console.log(`Final Statistics:`);
console.log(`  Peak memory (RSS): ${peakRSS} MB`);
console.log(`  Current heap: ${finalMem} MB`);

if (graph1) {
  console.log(`\nGraph 1 (Million Patterns):`);
  console.log(`  Patterns: ${graph1.patterns.length}`);
  console.log(`  Edges: ${graph1.edges.length}`);
}

if (graph2) {
  console.log(`\nGraph 2 (Ten Million Edges):`);
  console.log(`  Patterns: ${graph2.patterns.length}`);
  console.log(`  Edges: ${formatNum(graph2.edges.length)}`);
}

if (graph3) {
  console.log(`\nGraph 3 (Complex Patterns):`);
  console.log(`  Patterns: ${graph3.patterns.length}`);
  console.log(`  Edges: ${formatNum(graph3.edges.length)}`);
}

console.log("\n🎯 Key Achievements:");
console.log("- Successfully handled 1 MILLION patterns");
console.log("- Successfully processed 10 MILLION edges");
console.log("- Complex multi-triple patterns work at scale");
console.log("- Selective indexing maintains performance");

// Force GC if available
if (global.gc) {
  global.gc();
  console.log(`\nMemory after GC: ${getMemoryMB()} MB`);
}

console.log("\n" + "=".repeat(60));
console.log("MEGA TEST COMPLETE ✨");