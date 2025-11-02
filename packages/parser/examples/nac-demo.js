/**
 * NAC (Negative Application Conditions) Demo
 *
 * Demonstrates using NAC patterns to query for entities
 * that DON'T have certain properties - like finding
 * non-deleted people or orphaned entities.
 */

import { Graph } from "../src/minimal-graph.js";
import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeProgram } from "../src/pattern-words.js";

const graph = new Graph();
const context = createContext(graph);

console.log("=== NAC Pattern Demo ===\n");

// Program with deletion and NAC queries
const program = `
  ; Add some people
  fact [
    alice type person
    bob type person
    charlie type person
    diana type person
    alice age 30
    bob age 25
    charlie age 35
    diana age 28
  ]

  ; Mark some as deleted (tombstones)
  fact [
    bob deleted true
    charlie deleted true
  ]

  ; Query for ALL people (includes deleted)
  query [?x type person]

  ; Query for ACTIVE people (using NAC to exclude deleted)
  query [?x type person | not ?x deleted true]

  ; Query for people without ages (orphan detection)
  query [?x type person | not ?x age ?a]

  ; Add more test data
  fact [
    entity1 name "Solo Entity"
    entity2 name "Connected Entity"
    entity2 parent entity3
    entity3 name "Parent"
  ]

  ; Find entities with no relationships (orphans)
  query [?x name ?n | not ?x parent ?p | not ?x type ?t]
`;

console.log("Executing NAC pattern program...\n");

const ast = parsePattern(program);
const results = executeProgram(graph, ast, context);

// Extract different query results
let queryIndex = 0;
const queryResults = results.filter((r) =>
  Array.isArray(r) && (r.length === 0 || r[0] instanceof Map)
);

console.log("=== Query Results ===\n");

// Query 1: All people (includes deleted)
console.log("1. ALL people (includes deleted):");
if (queryResults[queryIndex]) {
  queryResults[queryIndex].forEach((binding) => {
    console.log(`   - ${binding.get("?X")}`);
  });
}
queryIndex++;

// Query 2: Active people (excludes deleted via NAC)
console.log("\n2. ACTIVE people (using NAC to exclude deleted):");
if (queryResults[queryIndex]) {
  queryResults[queryIndex].forEach((binding) => {
    console.log(`   - ${binding.get("?X")}`);
  });
}
queryIndex++;

// Query 3: People without ages
console.log("\n3. People WITHOUT ages (orphan detection):");
if (queryResults[queryIndex]) {
  queryResults[queryIndex].forEach((binding) => {
    console.log(`   - ${binding.get("?X")}`);
  });
}
queryIndex++;

// Query 4: Entities with no relationships
console.log("\n4. Entities with NO relationships (true orphans):");
if (queryResults[queryIndex]) {
  queryResults[queryIndex].forEach((binding) => {
    console.log(`   - ${binding.get("?X")}: ${binding.get("?N")}`);
  });
}

// Test NAC in rules
console.log("\n=== Testing NAC in Rules ===\n");

const ruleProgram = `
  ; Rule that only processes non-deleted people
  rule process-active [?p type person | not ?p deleted true] -> [?p status active]

  ; Trigger the rule
  fact [eve type person]
`;

const ruleAst = parsePattern(ruleProgram);
executeProgram(graph, ruleAst, context);

// Check who got marked as active
console.log("People marked as ACTIVE by rule:");
const activeResults = graph.query(["?P", "STATUS", "ACTIVE"]);
activeResults.forEach((binding) => {
  console.log(`   - ${binding.get("?P")}`);
});

console.log("\n=== Graph State ===");
console.log(`Total edges: ${graph.edges.length}`);
console.log("\nSample edges:");
graph.edges.slice(-10).forEach((edge) => {
  console.log(`  ${edge.source} --[${edge.attr}]--> ${edge.target}`);
});

// Cleanup
context.cleanup();
console.log("\n=== Demo Complete ===");
