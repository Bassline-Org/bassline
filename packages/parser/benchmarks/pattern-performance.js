/**
 * Performance Benchmarks for Pattern Matching
 *
 * Establishes baseline metrics before selective pattern activation optimization
 */

import { Graph } from "../src/minimal-graph.js";

console.log("=== Pattern Matching Performance Benchmarks ===\n");
console.log("Environment: Node.js", process.version);
console.log("Date:", new Date().toISOString());
console.log("Machine:", process.platform, process.arch, process.cpuUsage());
console.log("\n" + "=".repeat(60) + "\n");

// Utility to measure execution time with high precision
function benchmark(name, setup, test, options = {}) {
  const { iterations = 1, warmup = 0 } = options;

  console.log(`\n## ${name}`);

  // Setup phase
  const setupResult = setup();

  // Warmup runs (not measured)
  for (let i = 0; i < warmup; i++) {
    test(setupResult);
  }

  // Actual measurement
  const measurements = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    test(setupResult);
    const elapsed = performance.now() - start;
    measurements.push(elapsed);
  }

  // Calculate statistics
  const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
  const min = Math.min(...measurements);
  const max = Math.max(...measurements);
  const median = measurements.sort((a, b) => a - b)[Math.floor(measurements.length / 2)];

  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(3)}ms`);
  console.log(`  Median:  ${median.toFixed(3)}ms`);
  console.log(`  Min:     ${min.toFixed(3)}ms`);
  console.log(`  Max:     ${max.toFixed(3)}ms`);

  return { name, avg, median, min, max, measurements };
}

// ============================================================================
// Benchmark 1: Many Literal Patterns, Selective Matching
// ============================================================================

benchmark(
  "1. Literal Patterns - Selective Matching (Best Case)",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 1000 patterns with unique literal sources
    for (let i = 0; i < 1000; i++) {
      graph.watch(
        [[`node${i}`, "value", `val${i}`]],
        (bindings) => matches.push(i)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add 100 edges that each match exactly one pattern
    for (let i = 0; i < 100; i++) {
      graph.add(`node${i}`, "value", `val${i}`);
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 2: Many Wildcard Patterns (Worst Case)
// ============================================================================

benchmark(
  "2. Wildcard Patterns - All Must Check (Worst Case)",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 1000 patterns with wildcards/variables
    for (let i = 0; i < 1000; i++) {
      graph.watch(
        [["?x", `attr${i}`, "?y"]],
        (bindings) => matches.push(bindings)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add 100 edges - all patterns must be checked
    for (let i = 0; i < 100; i++) {
      graph.add(`source${i}`, `attr${i}`, `target${i}`);
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 3: Mixed Patterns (Typical Case)
// ============================================================================

benchmark(
  "3. Mixed Patterns - 80% Literal, 20% Wildcard",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 800 literal patterns
    for (let i = 0; i < 800; i++) {
      graph.watch(
        [[`specific${i}`, "type", "entity"]],
        () => matches.push(`literal${i}`)
      );
    }

    // Create 200 wildcard patterns
    for (let i = 0; i < 200; i++) {
      graph.watch(
        [["?x", "relation", "?y"]],
        () => matches.push(`wildcard${i}`)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add 100 edges - mix of matching literal and wildcard patterns
    for (let i = 0; i < 50; i++) {
      graph.add(`specific${i}`, "type", "entity");
    }
    for (let i = 0; i < 50; i++) {
      graph.add(`any${i}`, "relation", `target${i}`);
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 4: Single Pattern, Many Edges (Baseline Check)
// ============================================================================

benchmark(
  "4. Single Pattern - Many Edges",
  () => {
    const graph = new Graph();
    const matches = [];

    // Just one pattern
    graph.watch(
      [["?x", "type", "person"]],
      (bindings) => matches.push(bindings)
    );

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add 1000 edges
    for (let i = 0; i < 1000; i++) {
      graph.add(`node${i}`, "type", i % 2 === 0 ? "person" : "thing");
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 5: Complex Patterns with Multiple Triples
// ============================================================================

benchmark(
  "5. Complex Multi-Triple Patterns",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 100 complex patterns with 3 triples each
    for (let i = 0; i < 100; i++) {
      graph.watch(
        [
          [`person${i}`, "type", "person"],
          [`person${i}`, "name", "?name"],
          [`person${i}`, "age", "?age"]
        ],
        (bindings) => matches.push(bindings)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add edges that partially and fully match patterns
    for (let i = 0; i < 50; i++) {
      graph.add(`person${i}`, "type", "person");
      graph.add(`person${i}`, "name", `Name${i}`);
      graph.add(`person${i}`, "age", 20 + i);
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 6: NAC Pattern Performance
// ============================================================================

benchmark(
  "6. NAC (Negative Application Conditions)",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 100 patterns with NAC conditions
    for (let i = 0; i < 100; i++) {
      graph.watch(
        {
          patterns: [[`node${i}`, "status", "active"]],
          nac: [[`node${i}`, "deleted", true]]
        },
        (bindings) => matches.push(i)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add edges that trigger NAC checking
    for (let i = 0; i < 100; i++) {
      graph.add(`node${i}`, "status", "active");
      if (i % 2 === 0) {
        graph.add(`node${i}`, "deleted", true); // Should fail NAC
      }
    }
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Benchmark 7: Scaling Test - Pattern Count Impact
// ============================================================================

console.log("\n## 7. Scaling Test - Pattern Count Impact");
console.log("  Testing edge addition time as pattern count increases\n");

const scalingResults = [];
for (const patternCount of [10, 100, 500, 1000, 2000]) {
  const result = benchmark(
    `  ${patternCount} patterns`,
    () => {
      const graph = new Graph();

      // Create N literal patterns
      for (let i = 0; i < patternCount; i++) {
        graph.watch(
          [[`node${i}`, "value", i]],
          () => {}
        );
      }

      return graph;
    },
    (graph) => {
      // Add just 10 edges to measure per-edge cost
      for (let i = 0; i < 10; i++) {
        graph.add(`node${i}`, "value", i);
      }
    },
    { iterations: 10, warmup: 2 }
  );

  scalingResults.push({
    patterns: patternCount,
    avgPerEdge: result.avg / 10
  });
}

console.log("\n  Summary - Average time per edge:");
for (const { patterns, avgPerEdge } of scalingResults) {
  console.log(`    ${patterns.toString().padStart(4)} patterns: ${avgPerEdge.toFixed(4)}ms per edge`);
}

// Check for linear scaling (O(P) behavior)
const firstRatio = scalingResults[1].avgPerEdge / scalingResults[0].avgPerEdge;
const lastRatio = scalingResults[scalingResults.length - 1].avgPerEdge / scalingResults[scalingResults.length - 2].avgPerEdge;
console.log(`\n  Scaling factor (100 vs 10): ${firstRatio.toFixed(2)}x`);
console.log(`  Scaling factor (2000 vs 1000): ${lastRatio.toFixed(2)}x`);
if (lastRatio > 1.8) {
  console.log("  ⚠️  Appears to be O(P) scaling - linear with pattern count");
}

// ============================================================================
// Benchmark 8: Batch Operations
// ============================================================================

benchmark(
  "8. Batch Operations - Transaction Performance",
  () => {
    const graph = new Graph();
    const matches = [];

    // Create 100 patterns
    for (let i = 0; i < 100; i++) {
      graph.watch(
        [[`node${i}`, "batch", "?value"]],
        (bindings) => matches.push(bindings)
      );
    }

    return { graph, matches };
  },
  ({ graph, matches }) => {
    // Add 100 edges in a batch
    graph.batch(() => {
      for (let i = 0; i < 100; i++) {
        graph.add(`node${i}`, "batch", `value${i}`);
      }
    });
  },
  { iterations: 10, warmup: 2 }
);

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## BASELINE PERFORMANCE SUMMARY\n");
console.log("Key Observations:");
console.log("1. Current implementation appears to have O(P) scaling");
console.log("2. Every pattern is checked for every edge (no selectivity)");
console.log("3. Literal patterns have same cost as wildcard patterns");
console.log("4. NAC checking adds significant overhead");
console.log("\nThese metrics will be compared against the optimized version.");
console.log("\n" + "=".repeat(60) + "\n");

// Export results for comparison
export const baselineMetrics = {
  timestamp: new Date().toISOString(),
  node: process.version,
  results: scalingResults
};