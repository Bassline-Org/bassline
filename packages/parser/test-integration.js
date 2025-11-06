/**
 * Integration test: Parser + Runtime
 * Tests that parser AST correctly integrates with runtime via shim
 */

import { Graph } from "./src/minimal-graph.js";
import { parseProgram } from "./src/pattern-parser.js";
import { executeProgram, createContext } from "./src/pattern-words.js";

const graph = new Graph();
const context = createContext(graph);

// Test 1: Simple insert
console.log("=== Test 1: Simple Insert ===");
const program1 = parseProgram(`
  insert {
    alice { age 30 }
  }
`);
console.log("Parsed:", JSON.stringify(program1, null, 2));
executeProgram(graph, program1, context);
console.log("Graph edges:", graph.edges.length);
console.log("Edge 0:", graph.edges[0]);

// Test 2: Rule with variables
console.log("\n=== Test 2: Rule with Variables ===");
const program2 = parseProgram(`
  rule adult-check
    where { ?p age ?a }
    produce { ?p adult true }
`);
console.log("Commands:", program2.length);
if (program2[0] && program2[0].rule) {
  console.log("Parsed rule name:", program2[0].rule.name);
}
executeProgram(graph, program2, context);
console.log("Rules registered:", context.rules.size);

// Test 3: Named pattern + pattern ref
console.log("\n=== Test 3: Named Pattern + Ref ===");
const program3 = parseProgram(`
  pattern person-filter {
    ?x type person
  }

  insert {
    bob { type person age 25 }
  }

  rule test-ref
    where { <person-filter> ?x age ?a }
    produce { ?x verified true }
`);
console.log("Program commands:", program3.length);
console.log("First command type:", program3[0].pattern ? "pattern" : "other");
executeProgram(graph, program3, context);
console.log("Named patterns stored:", context.namedPatterns?.size);

console.log("\n=== All Tests Complete ===");
console.log("Total edges:", graph.edges.length);
console.log("Total rules:", context.rules.size);
