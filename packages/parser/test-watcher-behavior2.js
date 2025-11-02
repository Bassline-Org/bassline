import { Graph } from "./src/minimal-graph.js";

const graph = new Graph();

console.log("=== Testing Pattern Matching Behavior ===\n");

// Test 1: Query behavior
graph.add("AGG1", "AGGREGATE", "SUM");
graph.add("AGG1", "ITEM", 10);
graph.add("AGG1", "ITEM", 20);
graph.add("AGG1", "ITEM", 30);

console.log("Query with ?V:");
const results1 = graph.query(["AGG1", "ITEM", "?V"]);
console.log(`  Found ${results1.length} results:`, results1.map(r => r.get("?V")));

console.log("\nQuery with *:");
const results2 = graph.query(["AGG1", "ITEM", "*"]);
console.log(`  Found ${results2.length} results:`, results2);

// Test 2: Understanding watcher with ?V
console.log("\n=== Watcher with ?V binding ===");
let values = [];
graph.watch([
  ["?A", "AGGREGATE", "SUM"],
  ["?A", "ITEM", "?V"]
], (bindings) => {
  const v = bindings.get("?V");
  console.log(`  Watcher fired for value: ${v}`);
  values.push(v);
});

console.log("Collected values:", values);

// Test 3: Check if watcher fires on initial setup
console.log("\n=== Testing initial watcher firing ===");
const graph2 = new Graph();

// Add data BEFORE setting up watcher
graph2.add("AGG2", "AGGREGATE", "MAX");
graph2.add("AGG2", "ITEM", 100);
graph2.add("AGG2", "ITEM", 200);
graph2.add("AGG2", "ITEM", 300);

console.log("Setting up watcher AFTER data exists:");
let count = 0;
graph2.watch([
  ["AGG2", "AGGREGATE", "MAX"],
  ["AGG2", "ITEM", "?V"]
], (bindings) => {
  count++;
  console.log(`  Initial fire #${count}: V=${bindings.get("?V")}`);
});

console.log(`Total initial fires: ${count}`);