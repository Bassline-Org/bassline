import { Graph } from "./src/minimal-graph.js";

const graph = new Graph();

// Install a test watcher that logs when it fires
let fireCount = 0;
graph.watch([
  ["?A", "AGGREGATE", "?OP"],
  ["?A", "ITEM", "*"]
], (bindings) => {
  fireCount++;
  console.log(`Watcher fired #${fireCount}:`, {
    A: bindings.get("?A"),
    OP: bindings.get("?OP"),
    // Note: wildcard * doesn't create a binding
  });
});

console.log("Adding edges one by one:");

// Add aggregate type first
graph.add("AGG1", "AGGREGATE", "SUM");
console.log(`After AGGREGATE: fireCount = ${fireCount}`);

// Add items one by one
graph.add("AGG1", "ITEM", 10);
console.log(`After ITEM 10: fireCount = ${fireCount}`);

graph.add("AGG1", "ITEM", 20);
console.log(`After ITEM 20: fireCount = ${fireCount}`);

graph.add("AGG1", "ITEM", 30);
console.log(`After ITEM 30: fireCount = ${fireCount}`);

graph.add("AGG1", "ITEM", 40);
console.log(`After ITEM 40: fireCount = ${fireCount}`);

console.log("\nTotal fires:", fireCount);

// Now test with binding the item value
console.log("\n--- Testing with ?V binding ---");
let fireCount2 = 0;
graph.watch([
  ["?A", "AGGREGATE", "?OP"],
  ["?A", "ITEM", "?V"]
], (bindings) => {
  fireCount2++;
  console.log(`Watcher2 fired #${fireCount2}:`, {
    A: bindings.get("?A"),
    OP: bindings.get("?OP"),
    V: bindings.get("?V")
  });
});

// Add a new aggregation
graph.add("AGG2", "AGGREGATE", "AVG");
graph.add("AGG2", "ITEM", 5);
graph.add("AGG2", "ITEM", 10);
graph.add("AGG2", "ITEM", 15);

console.log("\nTotal fires for watcher2:", fireCount2);