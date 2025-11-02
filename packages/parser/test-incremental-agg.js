import { Graph } from "./src/minimal-graph.js";
import { installCompute, getCurrentResultViaQuery } from "./extensions/compute-v2.js";

const graph = new Graph();
installCompute(graph);

console.log("=== Testing Incremental Aggregation with Refinement ===\n");

// Add aggregation setup
graph.add("AGG1", "AGGREGATE", "SUM");

console.log("Adding items one by one:");

// Add first item
graph.add("AGG1", "ITEM", 10);
console.log("After adding 10:");
let result = getCurrentResultViaQuery(graph, "AGG1");
if (result !== null) {
  console.log(`  Current result: ${result}`);
}

// Add second item
graph.add("AGG1", "ITEM", 20);
console.log("After adding 20:");
result = getCurrentResultViaQuery(graph, "AGG1");
if (result !== null) {
  console.log(`  Current result: ${result}`);
}

// Add third item
graph.add("AGG1", "ITEM", 30);
console.log("After adding 30:");
result = getCurrentResultViaQuery(graph, "AGG1");
if (result !== null) {
  console.log(`  Current result: ${result}`);
}

// Add fourth item
graph.add("AGG1", "ITEM", 40);
console.log("After adding 40:");
result = getCurrentResultViaQuery(graph, "AGG1");
if (result !== null) {
  console.log(`  Current result: ${result}`);
}

console.log("\nFinal state inspection:");

// Get current version
const versionKey = "AGG1:VERSION";
const versionResults = graph.query([versionKey, "CURRENT", "?V"]);
if (versionResults.length > 0) {
  const currentVersion = versionResults[0].get("?V");
  console.log(`  Current version: ${currentVersion}`);

  const stateKey = `AGG1:STATE:V${currentVersion}`;
  const sumResults = graph.query([stateKey, "SUM", "?S"]);
  const countResults = graph.query([stateKey, "COUNT", "?C"]);

  if (sumResults.length > 0) {
    console.log(`  Current SUM: ${sumResults[0].get("?S")}`);
  }
  if (countResults.length > 0) {
    console.log(`  Current COUNT: ${countResults[0].get("?C")}`);
  }
}

console.log("\nAll versioned RESULT edges:");
const allResults = graph.edges.filter(e =>
  e.source === "AGG1" && e.attr.toString().startsWith("AGG1:RESULT:V")
);
allResults.forEach(e => {
  console.log(`  ${e.source} ${e.attr} ${e.target}`);
});

console.log("\nRefinement chain:");
const refinements = graph.edges.filter(e => e.attr === "REFINES");
refinements.forEach(e => {
  console.log(`  ${e.source} REFINES ${e.target}`);
});

console.log("\nVerifying refinement pattern:");
console.log(`  Total result edges: ${allResults.length}`);
console.log(`  Total refinement edges: ${refinements.length}`);
console.log(`  Should have ${allResults.length - 1} refinement edges (n-1 for n results)`);
console.log(`  Pattern is ${refinements.length === allResults.length - 1 ? "CORRECT" : "INCORRECT"}`);