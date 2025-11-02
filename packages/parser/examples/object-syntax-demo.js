/**
 * Object Syntax Demo
 *
 * Shows the cleaner object syntax for defining multiple triples
 * with the same source, and demonstrates how it actually works.
 */

import { Graph } from "../src/minimal-graph.js";
import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeProgram } from "../src/pattern-words.js";

const graph = new Graph();
const context = createContext(graph);

console.log("=== Object Syntax Demo ===\n");

// ============================================================================
// Part 1: Basic Object Syntax
// ============================================================================

console.log("--- Part 1: Object Syntax for Facts ---\n");

const objectSyntaxProgram = `
  ; Old way - repetitive
  fact [
    alice type person
    alice age 30
    alice city "New York"
    alice job developer
  ]

  ; New way - object syntax
  fact [
    bob {
      type person
      age 25
      city "San Francisco"
      job designer
    }

    charlie {
      type person
      age 35
      city "Austin"
    }
  ]

  ; Query all people
  query [?x type person]

  ; Query people with ages
  query [?x { type person age ?a }]
`;

let ast = parsePattern(objectSyntaxProgram);
let results = executeProgram(graph, ast, context);

// Show what got inserted
console.log("All people:");
results[results.length - 2].forEach(binding => {
  console.log(`  - ${binding.get("?X")}`);
});

console.log("\nPeople with ages:");
results[results.length - 1].forEach(binding => {
  console.log(`  - ${binding.get("?X")}: ${binding.get("?A")} years old`);
});

// ============================================================================
// Part 2: NAC with Object Syntax
// ============================================================================

console.log("\n--- Part 2: NAC with Object Syntax ---\n");

const nacObjectProgram = `
  ; Clear and setup
  clear-graph

  fact [
    alice { type person status active }
    bob { type person status deleted }
    charlie { type person status active }
    diana { type person }
  ]

  ; Query active people (exclude deleted using NAC with object)
  query [
    ?x type person
    not ?x { status deleted }
  ]

  ; Query people without any status
  query [
    ?x type person
    not ?x { status ?s }
  ]
`;

ast = parsePattern(nacObjectProgram);
results = executeProgram(graph, ast, context);

console.log("Active people (not deleted):");
results[results.length - 2].forEach(binding => {
  console.log(`  - ${binding.get("?X")}`);
});

console.log("\nPeople without status:");
results[results.length - 1].forEach(binding => {
  console.log(`  - ${binding.get("?X")}`);
});

// ============================================================================
// Part 3: Rules with Object Syntax
// ============================================================================

console.log("\n--- Part 3: Rules with Object Syntax ---\n");

const rulesProgram = `
  ; Clear for fresh start
  clear-graph

  ; Setup data
  fact [
    order1 { quantity 5 price 10 }
    order2 { quantity 3 price 20 }
    order3 { quantity 2 price 15 }
  ]

  ; Rule: Calculate order totals
  ; When we see quantity and price, mark for calculation
  rule calculate-total [
    ?order { quantity ?q price ?p }
  ] -> [
    ?order { needs-calc total source manual }
  ]

  ; Query orders needing calculation
  query [?o needs-calc total]

  ; Simulate adding totals (would be done by compute gadget)
  fact [
    order1 total 50
    order2 total 60
    order3 total 30
  ]

  ; Query completed orders
  query [?o { total ?t quantity ?q }]
`;

ast = parsePattern(rulesProgram);
results = executeProgram(graph, ast, context);

console.log("Orders marked for calculation:");
results[results.length - 3].forEach(binding => {
  console.log(`  - ${binding.get("?O")}`);
});

console.log("\nOrders with totals:");
results[results.length - 1].forEach(binding => {
  console.log(`  - ${binding.get("?O")}: ${binding.get("?T")} (qty: ${binding.get("?Q")})`);
});

// ============================================================================
// Part 4: Complex Pattern Matching
// ============================================================================

console.log("\n--- Part 4: Complex Patterns ---\n");

const complexProgram = `
  ; Clear and setup relationships
  clear-graph

  fact [
    ; People and their relationships
    alice {
      type person
      likes bob
      likes programming
      works-at techcorp
    }

    bob {
      type person
      likes alice
      likes design
      works-at techcorp
    }

    charlie {
      type person
      likes programming
      works-at startup
    }

    ; Companies
    techcorp {
      type company
      location "NYC"
      size large
    }

    startup {
      type company
      location "SF"
      size small
    }
  ]

  ; Find people who work at the same company
  rule coworkers [
    ?p1 { type person works-at ?company }
    ?p2 { type person works-at ?company }
  ] -> [
    ?p1 coworker ?p2
  ]

  ; Find mutual likes
  rule mutual-like [
    ?x likes ?y
    ?y likes ?x
  ] -> [
    mutual-like { between-1 ?x between-2 ?y }
  ]

  ; Query coworkers
  query [alice coworker ?who]

  ; Query mutual likes
  query [mutual-like { between-1 ?a between-2 ?b }]
`;

ast = parsePattern(complexProgram);
results = executeProgram(graph, ast, context);

console.log("Alice's coworkers:");
const coworkers = results[results.length - 2];
const uniqueCoworkers = new Set();
coworkers.forEach(binding => {
  const who = binding.get("?WHO");
  if (who !== "ALICE") uniqueCoworkers.add(who);
});
uniqueCoworkers.forEach(who => console.log(`  - ${who}`));

console.log("\nMutual likes:");
const mutuals = results[results.length - 1];
const seen = new Set();
mutuals.forEach(binding => {
  const a = binding.get("?A");
  const b = binding.get("?B");
  const pair = [a, b].sort().join("-");
  if (!seen.has(pair)) {
    seen.add(pair);
    console.log(`  - ${a} ↔ ${b}`);
  }
});

// ============================================================================
// Show Graph State
// ============================================================================

console.log("\n=== Graph Statistics ===");
console.log(`Total edges: ${graph.edges.length}`);

console.log("\nSample of last 10 edges:");
graph.edges.slice(-10).forEach(edge => {
  console.log(`  ${edge.source} --[${edge.attr}]--> ${edge.target}`);
});

// Cleanup
context.cleanup();
console.log("\n=== Demo Complete ===");