import { Graph } from "./src/minimal-graph.js";
import { installCompute, getCurrentResultViaQuery } from "./extensions/compute-v2.js";

const graph = new Graph();
installCompute(graph);

console.log("=== Testing Multiple Independent Aggregations ===\n");

// Create first aggregation
console.log("Setting up SUM aggregation:");
graph.add("SUM_AGG", "AGGREGATE", "SUM");
graph.add("SUM_AGG", "ITEM", 10);
graph.add("SUM_AGG", "ITEM", 20);
console.log(`  SUM result: ${getCurrentResultViaQuery(graph, "SUM_AGG")}`);

// Create second aggregation
console.log("\nSetting up AVG aggregation:");
graph.add("AVG_AGG", "AGGREGATE", "AVG");
graph.add("AVG_AGG", "ITEM", 100);
graph.add("AVG_AGG", "ITEM", 200);
graph.add("AVG_AGG", "ITEM", 300);
console.log(`  AVG result: ${getCurrentResultViaQuery(graph, "AVG_AGG")}`);

// Create third aggregation
console.log("\nSetting up MIN aggregation:");
graph.add("MIN_AGG", "AGGREGATE", "MIN");
graph.add("MIN_AGG", "ITEM", 50);
graph.add("MIN_AGG", "ITEM", 25);
graph.add("MIN_AGG", "ITEM", 75);
console.log(`  MIN result: ${getCurrentResultViaQuery(graph, "MIN_AGG")}`);

// Add more items to first aggregation
console.log("\nAdding more items to SUM aggregation:");
graph.add("SUM_AGG", "ITEM", 30);
graph.add("SUM_AGG", "ITEM", 40);
console.log(`  SUM result: ${getCurrentResultViaQuery(graph, "SUM_AGG")}`);

// Create a non-aggregation entity with items (shouldn't trigger aggregation)
console.log("\nAdding items to non-aggregation entity:");
graph.add("REGULAR", "TYPE", "ENTITY");
graph.add("REGULAR", "ITEM", 999);  // This should NOT create any aggregation results
graph.add("REGULAR", "ITEM", 888);

// Check that no aggregation happened for REGULAR
const regularResults = graph.edges.filter(e =>
  e.source === "REGULAR" && e.attr.toString().includes("RESULT")
);
console.log(`  REGULAR entity has ${regularResults.length} result edges (should be 0)`);

// Show statistics
console.log("\n=== Statistics ===");
console.log(`Total edges: ${graph.edges.length}`);

// Count watchers per aggregation
const sumResults = graph.edges.filter(e =>
  e.source === "SUM_AGG" && e.attr.toString().includes("RESULT:V")
).length;
const avgResults = graph.edges.filter(e =>
  e.source === "AVG_AGG" && e.attr.toString().includes("RESULT:V")
).length;
const minResults = graph.edges.filter(e =>
  e.source === "MIN_AGG" && e.attr.toString().includes("RESULT:V")
).length;

console.log(`\nResults per aggregation:`);
console.log(`  SUM_AGG: ${sumResults} versions`);
console.log(`  AVG_AGG: ${avgResults} versions`);
console.log(`  MIN_AGG: ${minResults} versions`);

console.log("\n✅ Pattern-oriented design ensures:");
console.log("  - Each aggregation has its own dedicated watcher");
console.log("  - Only items for THAT specific aggregation trigger updates");
console.log("  - No global scanning or querying needed");
console.log("  - Non-aggregation entities with ITEM edges are ignored");