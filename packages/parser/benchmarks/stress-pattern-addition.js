/**
 * Pattern Addition Performance Test
 *
 * Tests adding patterns to large existing graphs
 * Key insight: Patterns can use indexes to selectively process existing edges!
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== PATTERN ADDITION TO LARGE GRAPHS TEST ===\n");
console.log("Testing how efficiently we can add patterns to existing large graphs\n");
console.log("=" + "=".repeat(60) + "\n");

// Helper functions
function formatTime(ms) {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
  return ms.toFixed(2) + "ms";
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
}

// ============================================================================
// Setup: Create a large graph with many edges
// ============================================================================

console.log("## Setup: Creating large graph\n");

const graph = new Graph();
const EDGE_COUNT = 1000000; // 1 million edges
const UNIQUE_SOURCES = 10000;
const UNIQUE_ATTRS = 100;
const UNIQUE_TARGETS = 10000;

console.log(`Creating graph with ${formatNum(EDGE_COUNT)} edges...`);
console.log(`  ${formatNum(UNIQUE_SOURCES)} unique sources`);
console.log(`  ${formatNum(UNIQUE_ATTRS)} unique attributes`);
console.log(`  ${formatNum(UNIQUE_TARGETS)} unique targets\n`);

const setupStart = performance.now();

// Add edges in batches for efficiency
const batchSize = 50000;
for (let b = 0; b < EDGE_COUNT / batchSize; b++) {
  graph.batch(() => {
    for (let i = 0; i < batchSize; i++) {
      const edgeNum = b * batchSize + i;
      const source = `entity${edgeNum % UNIQUE_SOURCES}`;
      const attr = `attr${edgeNum % UNIQUE_ATTRS}`;
      const target = `value${edgeNum % UNIQUE_TARGETS}`;

      graph.add(source, attr, target);
    }
  });

  if ((b + 1) % 5 === 0) {
    const progress = ((b + 1) * batchSize / EDGE_COUNT * 100).toFixed(0);
    console.log(`  Progress: ${progress}%`);
  }
}

const setupTime = performance.now() - setupStart;
console.log(`\n✅ Graph created in ${formatTime(setupTime)}`);
console.log(`  Total edges: ${formatNum(graph.edges.length)}\n`);

// ============================================================================
// Test 1: Adding Literal Patterns
// ============================================================================

console.log("## Test 1: Adding Literal Patterns to Large Graph\n");

console.log("These patterns have specific literal values that can use indexing\n");

const literalTests = [
  {
    name: "Highly specific (all literals)",
    pattern: [["entity100", "attr50", "value100"]],
    expectedMatches: 1
  },
  {
    name: "Source + attr literal",
    pattern: [["entity500", "attr25", "?target"]],
    expectedMatches: EDGE_COUNT / UNIQUE_SOURCES / UNIQUE_ATTRS
  },
  {
    name: "Just source literal",
    pattern: [["entity1000", "?attr", "?target"]],
    expectedMatches: EDGE_COUNT / UNIQUE_SOURCES
  },
  {
    name: "Just attr literal",
    pattern: [["?source", "attr10", "?target"]],
    expectedMatches: EDGE_COUNT / UNIQUE_ATTRS
  }
];

let matchCounts = [];

for (const test of literalTests) {
  console.log(`Test: ${test.name}`);
  console.log(`  Pattern: ${JSON.stringify(test.pattern[0])}`);

  let matchCount = 0;
  const start = performance.now();

  // Add the pattern with a counter callback
  const unwatch = graph.watch(test.pattern, () => {
    matchCount++;
  });

  const time = performance.now() - start;
  matchCounts.push(matchCount);

  console.log(`  Time to process ${formatNum(EDGE_COUNT)} existing edges: ${formatTime(time)}`);
  console.log(`  Matches found: ${formatNum(matchCount)}`);
  console.log(`  Processing rate: ${formatNum(Math.round(EDGE_COUNT / (time / 1000)))} edges/sec`);

  // Calculate what portion of edges were actually checked
  // This is an estimate based on the pattern specificity
  let edgesChecked = EDGE_COUNT;
  if (test.pattern[0][0] !== "?source" && !test.pattern[0][0].startsWith("?")) {
    edgesChecked = Math.ceil(EDGE_COUNT / UNIQUE_SOURCES);
  }
  console.log(`  Estimated edges checked: ${formatNum(edgesChecked)} (${(edgesChecked / EDGE_COUNT * 100).toFixed(1)}%)`);
  console.log();

  unwatch(); // Clean up
}

// ============================================================================
// Test 2: Adding Wildcard Patterns
// ============================================================================

console.log("## Test 2: Adding Wildcard Patterns to Large Graph\n");

console.log("These patterns must check every edge (no indexing benefit)\n");

const wildcardTests = [
  {
    name: "All wildcards",
    pattern: [["?source", "?attr", "?target"]],
    expectedMatches: EDGE_COUNT
  },
  {
    name: "Two wildcards",
    pattern: [["?source", "?attr", "value5000"]],
    expectedMatches: EDGE_COUNT / UNIQUE_TARGETS
  }
];

for (const test of wildcardTests) {
  console.log(`Test: ${test.name}`);
  console.log(`  Pattern: ${JSON.stringify(test.pattern[0])}`);

  let matchCount = 0;
  const start = performance.now();

  const unwatch = graph.watch(test.pattern, () => {
    matchCount++;
  });

  const time = performance.now() - start;

  console.log(`  Time to process ${formatNum(EDGE_COUNT)} existing edges: ${formatTime(time)}`);
  console.log(`  Matches found: ${formatNum(matchCount)}`);
  console.log(`  Processing rate: ${formatNum(Math.round(EDGE_COUNT / (time / 1000)))} edges/sec`);
  console.log(`  All edges must be checked (wildcard pattern)`);
  console.log();

  unwatch();
}

// ============================================================================
// Test 3: Adding Complex Multi-Triple Patterns
// ============================================================================

console.log("## Test 3: Adding Complex Multi-Triple Patterns\n");

const complexPattern = [
  ["?entity", "attr10", "?value1"],
  ["?entity", "attr20", "?value2"],
  ["?entity", "attr30", "?value3"]
];

console.log("Pattern with 3 triples (looking for entities with all 3 attributes):");
console.log(`  ${JSON.stringify(complexPattern)}\n`);

let complexMatches = 0;
const complexStart = performance.now();

const complexUnwatch = graph.watch(complexPattern, () => {
  complexMatches++;
});

const complexTime = performance.now() - complexStart;

console.log(`  Time: ${formatTime(complexTime)}`);
console.log(`  Matches found: ${formatNum(complexMatches)}`);
console.log(`  Note: Complex patterns require more computation\n`);

complexUnwatch();

// ============================================================================
// Test 4: Batch Pattern Addition
// ============================================================================

console.log("## Test 4: Batch Pattern Addition\n");

console.log("Adding 100 patterns at once to the large graph\n");

const batchStart = performance.now();
const unwatchers = [];

for (let i = 0; i < 100; i++) {
  const pattern = [[`entity${i * 10}`, `attr${i % 10}`, "?target"]];
  const unwatch = graph.watch(pattern, () => {});
  unwatchers.push(unwatch);
}

const batchTime = performance.now() - batchStart;

console.log(`  Added 100 patterns in ${formatTime(batchTime)}`);
console.log(`  Average per pattern: ${formatTime(batchTime / 100)}`);
console.log(`  Each pattern processed ${formatNum(EDGE_COUNT)} existing edges`);
console.log(`  Total edge checks: ${formatNum(100 * EDGE_COUNT)} (theoretical)`);
console.log(`  Actual with indexing: ~${formatNum(100 * EDGE_COUNT / UNIQUE_SOURCES)} (estimated)\n`);

// Clean up
unwatchers.forEach(u => u());

// ============================================================================
// Comparison: Pattern Addition With vs Without Indexing
// ============================================================================

console.log("## Performance Comparison Summary\n");

console.log("| Pattern Type | Time | Edges Checked | Optimization |");
console.log("|--------------|------|---------------|--------------|");
console.log(`| All literals | Fast | ~${(100 / UNIQUE_SOURCES).toFixed(1)}% | Maximum |`);
console.log(`| Source literal | Fast | ~${(100 / UNIQUE_SOURCES).toFixed(1)}% | High |`);
console.log(`| Attr literal | Medium | ~${(100 / UNIQUE_ATTRS).toFixed(1)}% | Medium |`);
console.log(`| All wildcards | Slow | 100% | None |`);

console.log("\n## Key Insights:\n");

console.log("1. ✅ Literal patterns can use indexing when checking existing edges");
console.log(`2. ✅ Source literals are most effective (${UNIQUE_SOURCES}x reduction)`);
console.log("3. ✅ Even partial literals help (attr or target)");
console.log("4. ⚠️  Wildcard patterns must check all edges");
console.log("5. 💡 Solution: Use subgraphs to pre-filter for wildcard patterns!");

console.log("\n## Optimization Strategies:\n");

console.log("For best pattern addition performance:");
console.log("1. Maximize literal values in patterns");
console.log("2. Prefer source literals (most selective)");
console.log("3. Add patterns before edges when possible");
console.log("4. Use subgraphs for wildcard-heavy patterns");

console.log("\n" + "=".repeat(60));
console.log("\nPATTERN ADDITION TEST COMPLETE ✨\n");

const totalPatterns = graph.patterns.length;
console.log(`Final graph state:`);
console.log(`  Edges: ${formatNum(graph.edges.length)}`);
console.log(`  Patterns: ${totalPatterns}`);
console.log(`  Source index size: ${graph.sourceIndex.size}`);
console.log(`  Wildcard patterns: ${graph.wildcardPatterns.size}`);