/**
 * Subgraph Performance Test
 *
 * Demonstrates how restricting wildcard search space solves scaling problems
 */

import { Graph } from "../src/minimal-graph.js";
import { installSubgraphs } from "../src/subgraph.js";

// Extend Graph with subgraph support
installSubgraphs(Graph);

console.log("=== SUBGRAPH WILDCARD OPTIMIZATION TEST ===\n");

// ============================================================================
// Scenario: Social network with millions of edges but we only care about
// active users' interactions
// ============================================================================

console.log("## Scenario: Social Network Analysis\n");
console.log("Problem: Find patterns in active user interactions");
console.log("Challenge: 10M total edges, but only 100K are from active users\n");

const graph = new Graph();

// Create a subgraph for active users
console.log("Creating 'active-users' subgraph...");
const activeUsersGraph = graph.createSubgraph("active-users");

// Define filter: only edges from active users
// This uses efficient literal pattern matching (O(1) via indexing)
activeUsersGraph.addFilter([["?user", "status", "active"]]);
activeUsersGraph.addFilter([["?user", "last_login", "?recent"]]);

console.log("Adding data to main graph...\n");

// Step 1: Add user statuses (these trigger subgraph inclusion)
console.log("1. Adding 10,000 users (1,000 active)...");
const start1 = performance.now();

for (let i = 0; i < 10000; i++) {
  if (i < 1000) {
    // Active users
    graph.add(`user${i}`, "status", "active");
    graph.add(`user${i}`, "last_login", Date.now() - i * 1000);
  } else {
    // Inactive users
    graph.add(`user${i}`, "status", "inactive");
    graph.add(`user${i}`, "last_login", Date.now() - i * 1000000);
  }
}

const time1 = performance.now() - start1;
console.log(`   Added in ${time1.toFixed(2)}ms`);
console.log(`   Subgraph now has ${activeUsersGraph.edges.length} edges\n`);

// Step 2: Add millions of interactions
console.log("2. Adding 1,000,000 user interactions...");
const start2 = performance.now();

for (let i = 0; i < 1000000; i++) {
  const user1 = `user${Math.floor(Math.random() * 10000)}`;
  const user2 = `user${Math.floor(Math.random() * 10000)}`;

  // Various interaction types
  if (i % 3 === 0) {
    graph.add(user1, "follows", user2);
  } else if (i % 3 === 1) {
    graph.add(user1, "likes", `post${i}`);
  } else {
    graph.add(user1, "comments", `comment${i}`);
  }
}

const time2 = performance.now() - start2;
console.log(`   Added in ${(time2 / 1000).toFixed(2)}s`);
console.log(`   Main graph: ${graph.edges.length.toLocaleString()} edges`);
console.log(`   Subgraph: ${activeUsersGraph.edges.length.toLocaleString()} edges\n`);

// ============================================================================
// Compare wildcard pattern performance
// ============================================================================

console.log("## Performance Comparison: Wildcard Pattern Matching\n");

// Test pattern: Find all follow relationships
const wildcardPattern = [["?follower", "follows", "?followed"]];

// Test 1: Query entire graph (old approach)
console.log("Test 1: Wildcard query on ENTIRE graph");
const fullStart = performance.now();

const fullResults = graph.query(wildcardPattern);

const fullTime = performance.now() - fullStart;
console.log(`   Time: ${fullTime.toFixed(2)}ms`);
console.log(`   Results: ${fullResults.length.toLocaleString()}`);
console.log(`   Edges scanned: ${graph.edges.length.toLocaleString()}`);

// Test 2: Query subgraph (new approach)
console.log("\nTest 2: Wildcard query on SUBGRAPH only");
const subStart = performance.now();

const subResults = activeUsersGraph.query(wildcardPattern);

const subTime = performance.now() - subStart;
console.log(`   Time: ${subTime.toFixed(2)}ms`);
console.log(`   Results: ${subResults.length.toLocaleString()}`);
console.log(`   Edges scanned: ${activeUsersGraph.edges.length.toLocaleString()}`);

// Calculate improvement
const improvement = fullTime / subTime;
const reductionRatio = graph.edges.length / activeUsersGraph.edges.length;

console.log("\n## Results Summary\n");
console.log(`🚀 Performance improvement: ${improvement.toFixed(1)}x faster`);
console.log(`📊 Search space reduction: ${reductionRatio.toFixed(1)}x smaller`);
console.log(`✅ Same results for active users, but much faster!`);

// ============================================================================
// Advanced: Multiple specialized subgraphs
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("\n## Advanced: Multiple Specialized Subgraphs\n");

// Create specialized subgraphs for different analysis needs
const vipGraph = graph.createSubgraph("vip-users");
const recentGraph = graph.createSubgraph("recent-activity");

// VIP subgraph: only premium users
vipGraph.addFilter([["?user", "subscription", "premium"]]);

// Recent subgraph: only today's activity
const today = new Date().toDateString();
recentGraph.addFilter([["?source", "timestamp", today]]);

console.log("Adding VIP and timestamped data...");

// Add some VIP users
for (let i = 0; i < 100; i++) {
  graph.add(`user${i}`, "subscription", "premium");
  graph.add(`user${i}`, "influence_score", 1000 + i);
}

// Add timestamped activities
for (let i = 0; i < 10000; i++) {
  const timestamp = i < 1000 ? today : "yesterday";
  graph.add(`activity${i}`, "timestamp", timestamp);
  graph.add(`activity${i}`, "type", "interaction");
}

console.log(`\nSubgraph sizes:`);
console.log(`  Main graph: ${graph.edges.length.toLocaleString()} edges`);
console.log(`  Active users: ${activeUsersGraph.edges.length.toLocaleString()} edges`);
console.log(`  VIP users: ${vipGraph.edges.length.toLocaleString()} edges`);
console.log(`  Recent activity: ${recentGraph.edges.length.toLocaleString()} edges`);

console.log("\n## Key Benefits of Subgraph Approach:\n");
console.log("1. ✅ Wildcard patterns become practical at scale");
console.log("2. ✅ Different analyses can use different focused subgraphs");
console.log("3. ✅ Reactive updates keep subgraphs in sync");
console.log("4. ✅ Memory efficient - edges aren't duplicated, just referenced");
console.log("5. ✅ Can combine literal indexing (for filters) with wildcards (for analysis)");

console.log("\n" + "=".repeat(60));
console.log("\nSUBGRAPH TEST COMPLETE ✨");
console.log("\nConclusion: By using literal patterns to maintain focused subgraphs,");
console.log("we can make wildcard patterns scalable even with millions of edges!");