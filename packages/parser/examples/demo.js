/**
 * Demo of the Pattern Matching System
 *
 * This demonstrates the complete integration of:
 * - pattern-parser.js: Native pattern syntax with ?variables and wildcards
 * - pattern-words.js: Runtime execution bridge
 * - minimal-graph.js: Core pattern matching engine
 */

import { Graph } from "../src/minimal-graph.js";
import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeProgram } from "../src/pattern-words.js";

// Create a new graph and context
const graph = new Graph();
const context = createContext(graph);

// Define our pattern program
const program = `
  ; Define facts about people and their properties
  fact [
    alice type person
    bob type person
    charlie type person
    alice age 30
    bob age 25
    charlie age 35
    alice likes coffee
    bob likes tea
    charlie likes coffee
  ]

  ; Define a rule that creates friendships based on shared interests
  rule make-friends [?x likes ?thing] -> [?x friend-of ?thing-lovers]

  ; Define a pattern to watch for people with ages
  pattern person-age-tracker [?p type person | ?p age ?a]

  ; Query for all people
  query [?x type person]

  ; Query for coffee lovers
  query [?who likes coffee]

  ; Query with wildcards - who likes anything?
  query [?person likes *]
`;

console.log("=== Pattern Matching Demo ===\n");

// Parse the program
console.log("Parsing pattern program...");
const ast = parsePattern(program);
console.log(`Parsed ${ast.commands.length} commands\n`);

// Execute the program
console.log("Executing program...");
const results = executeProgram(graph, ast, context);

// Display results
console.log("\n=== Results ===\n");

// Facts added (FACT_BLOCK returns an array of edge IDs)
const factArrays = results.filter((r) =>
  Array.isArray(r) && r.every((id) => typeof id === "number")
);
const factCount = factArrays.reduce((sum, arr) => sum + arr.length, 0);
console.log(`✓ Added ${factCount} facts to the graph\n`);

// Other results (patterns, rules, queries)
// Queries return arrays of Map objects (bindings), or empty arrays
// Facts return arrays of numbers
const queries = results.filter((r) =>
  Array.isArray(r) && (r.length === 0 || r[0] instanceof Map)
);
const patterns = results.filter((r) =>
  typeof r === "string" && r.includes("-")
);

console.log(`✓ Defined ${patterns.length} patterns/rules\n`);

if (queries.length > 0) {
  console.log("Query: All people");
  queries[0].forEach((binding) => {
    console.log(`  - ${binding.get("?X")}`);
  });
}

if (queries.length > 1) {
  console.log("\nQuery: Coffee lovers");
  queries[1].forEach((binding) => {
    console.log(`  - ${binding.get("?WHO")}`);
  });
}

if (queries.length > 2) {
  console.log("\nQuery: Who likes what (using wildcard)");
  queries[2].forEach((binding) => {
    const person = binding.get("?PERSON");
    // Find what they like from the graph
    const likes = graph.edges.filter((e) =>
      e.source === person && e.attr === "LIKES"
    );
    likes.forEach((edge) => {
      console.log(`  - ${person} likes ${edge.target}`);
    });
  });
}

// Show all edges in the graph
console.log("\n=== Complete Graph ===");
console.log(`Total edges: ${graph.edges.length}\n`);
graph.edges.forEach((edge) => {
  console.log(`  ${edge.source} --[${edge.attr}]--> ${edge.target}`);
});

// Show active patterns
console.log("\n=== Active Patterns ===");
context.patterns.forEach((pattern, name) => {
  console.log(`  - Pattern: ${name}`);
});

// Demonstrate cascading by adding a new person
console.log("\n=== Testing Rule Cascades ===");

const cascadeProgram = `
  ; Define cascading rules
  rule step1 [?x type person] -> [?x verified true]
  rule step2 [?x verified true] -> [?x processed true]
  rule step3 [?x processed true] -> [?x complete true]

  ; Add a new person to trigger the cascade
  fact [diana type person]
`;

console.log("Adding cascading rules and new fact...");
const cascade = parsePattern(cascadeProgram);
executeProgram(graph, cascade, context);

// Check if cascade completed
const dianaComplete = graph.query(["DIANA", "COMPLETE", "TRUE"]);
if (dianaComplete.length > 0) {
  console.log("✓ Rules cascaded successfully - Diana is complete!");
}

// Cleanup
context.cleanup();
console.log("\n=== Demo Complete ===");
