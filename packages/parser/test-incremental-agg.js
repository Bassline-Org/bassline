import { Graph } from "./src/minimal-graph.js";
import { installCompute } from "./extensions/compute-v2.js";

const graph = new Graph();
installCompute(graph);

console.log("=== Testing Incremental Aggregation ===\n");

// Add aggregation setup
graph.add("AGG1", "AGGREGATE", "SUM");

console.log("Adding items one by one:");

// Add first item
graph.add("AGG1", "ITEM", 10);
console.log("After adding 10:");
let results = graph.query(["AGG1", "RESULT", "?R"]);
if (results.length > 0) {
  // Get the LATEST result (last one in the array)
  console.log(`  Current result: ${results[results.length - 1].get("?R")}`);
}

// Add second item
graph.add("AGG1", "ITEM", 20);
console.log("After adding 20:");
results = graph.query(["AGG1", "RESULT", "?R"]);
if (results.length > 0) {
  console.log(`  Current result: ${results[results.length - 1].get("?R")}`);
}

// Add third item
graph.add("AGG1", "ITEM", 30);
console.log("After adding 30:");
results = graph.query(["AGG1", "RESULT", "?R"]);
if (results.length > 0) {
  console.log(`  Current result: ${results[results.length - 1].get("?R")}`);
}

// Add fourth item
graph.add("AGG1", "ITEM", 40);
console.log("After adding 40:");
results = graph.query(["AGG1", "RESULT", "?R"]);
if (results.length > 0) {
  console.log(`  Current result: ${results[results.length - 1].get("?R")}`);
}

console.log("\nFinal internal state:");
const sumState = graph.query(["AGG1", "_SUM", "?S"]);
const countState = graph.query(["AGG1", "_COUNT", "?C"]);
if (sumState.length > 0) {
  console.log(`  _SUM: ${sumState[0].get("?S")}`);
}
if (countState.length > 0) {
  console.log(`  _COUNT: ${countState[0].get("?C")}`);
}

console.log("\nAll RESULT edges for AGG1:");
const allResults = graph.edges.filter(e =>
  e.source === "AGG1" && e.attr === "RESULT"
);
allResults.forEach(e => {
  console.log(`  AGG1 RESULT ${e.target}`);
});

console.log("\nAll _SUM edges for AGG1:");
const allSums = graph.edges.filter(e =>
  e.source === "AGG1" && e.attr === "_SUM"
);
allSums.forEach(e => {
  console.log(`  AGG1 _SUM ${e.target}`);
});

console.log("\nAll _COUNT edges for AGG1:");
const allCounts = graph.edges.filter(e =>
  e.source === "AGG1" && e.attr === "_COUNT"
);
allCounts.forEach(e => {
  console.log(`  AGG1 _COUNT ${e.target}`);
});