/**
 * Test to debug pattern indexing
 */

import { Graph } from "./src/minimal-graph.js";

const graph = new Graph();

// Test 1: Pure literal pattern
console.log("=== Test 1: Pure Literal Pattern ===");
const unwatch1 = graph.watch(
  [["alice", "likes", "bob"]],
  () => console.log("Pattern 1 matched!")
);

console.log("Wildcard patterns:", graph.wildcardPatterns.size);
console.log("Source index:", graph.sourceIndex.size);
console.log("Attr index:", graph.attrIndex.size);
console.log("Target index:", graph.targetIndex.size);

// Test 2: Pattern with variable
console.log("\n=== Test 2: Pattern with Variable ===");
const unwatch2 = graph.watch(
  [["?x", "likes", "bob"]],
  () => console.log("Pattern 2 matched!")
);

console.log("Wildcard patterns:", graph.wildcardPatterns.size);
console.log("Source index:", graph.sourceIndex.size);
console.log("Attr index:", graph.attrIndex.size);
console.log("Target index:", graph.targetIndex.size);

// Test 3: Many literal patterns
console.log("\n=== Test 3: Many Literal Patterns ===");
for (let i = 0; i < 10; i++) {
  graph.watch(
    [[`node${i}`, "value", `val${i}`]],
    () => {}
  );
}

console.log("Wildcard patterns:", graph.wildcardPatterns.size);
console.log("Source index keys:", [...graph.sourceIndex.keys()]);
console.log("Source index size:", graph.sourceIndex.size);

// Test getCandidatePatterns
console.log("\n=== Test 4: Candidate Patterns ===");
const edge1 = { source: "alice", attr: "likes", target: "bob" };
const candidates1 = graph.getCandidatePatterns(edge1);
console.log(`Candidates for alice->likes->bob: ${candidates1.size} patterns`);

const edge2 = { source: "node5", attr: "value", target: "val5" };
const candidates2 = graph.getCandidatePatterns(edge2);
console.log(`Candidates for node5->value->val5: ${candidates2.size} patterns`);

const edge3 = { source: "unknown", attr: "unknown", target: "unknown" };
const candidates3 = graph.getCandidatePatterns(edge3);
console.log(`Candidates for unknown edges: ${candidates3.size} patterns`);

// Check if patterns are being indexed correctly
console.log("\n=== Debug Pattern Indexing ===");
const testPattern = graph.patterns[0];
if (testPattern) {
  console.log("First pattern spec:", testPattern.spec);
  console.log("Has wildcards?", testPattern.hasWildcardsOrVariables());
  console.log("Literal values:", testPattern.getLiteralValues());
}