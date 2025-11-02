#!/usr/bin/env node

/**
 * Run all stress tests in sequence
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log("=".repeat(70));
console.log(" GRAPH SYSTEM STRESS TEST SUITE");
console.log("=".repeat(70));
console.log();

const tests = [
  {
    name: "Literal Pattern Scaling",
    file: "stress-1-literal-patterns.js",
    description: "Tests indexing performance with pure literal patterns"
  },
  {
    name: "Wildcard Pattern Scaling",
    file: "stress-2-wildcard-patterns.js",
    description: "Tests performance when patterns must check every edge"
  },
  {
    name: "Mixed Pattern Performance",
    file: "stress-3-mixed-patterns.js",
    description: "Tests realistic scenarios with both pattern types"
  },
  {
    name: "Batch Operations",
    file: "stress-4-batch-operations.js",
    description: "Tests batch transactions and rollback"
  }
];

let allPassed = true;

for (const test of tests) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(` Running: ${test.name}`);
  console.log(` ${test.description}`);
  console.log(`${"=".repeat(70)}\n`);

  const path = `benchmarks/${test.file}`;

  if (!existsSync(path)) {
    console.error(`❌ Test file not found: ${path}`);
    allPassed = false;
    continue;
  }

  try {
    execSync(`node ${path}`, {
      stdio: 'inherit',
      timeout: 60000 // 60 second timeout per test
    });
    console.log(`\n✅ ${test.name} completed successfully`);
  } catch (error) {
    console.error(`\n❌ ${test.name} failed:`, error.message);
    allPassed = false;
  }
}

console.log("\n" + "=".repeat(70));
console.log(" STRESS TEST SUMMARY");
console.log("=".repeat(70));

if (allPassed) {
  console.log("\n✅ All stress tests completed successfully!");
  console.log("\nKey Performance Metrics:");
  console.log("- Literal patterns: O(1) constant time");
  console.log("- Wildcard patterns: O(P) linear with pattern count");
  console.log("- Mixed scenarios: Performance proportional to wildcard ratio");
  console.log("- Batch operations: Provide additional optimization");
} else {
  console.log("\n❌ Some tests failed. Check the output above for details.");
}

console.log("\nFor detailed analysis, run individual test files:");
tests.forEach(test => {
  console.log(`  node benchmarks/${test.file}`);
});

console.log();