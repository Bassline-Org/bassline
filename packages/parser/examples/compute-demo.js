/**
 * Computation Through Patterns Demo
 *
 * Shows how computation emerges from pattern matching without
 * adding expression syntax to the language. Everything is just
 * pattern matching and graph rewriting.
 *
 * Key insight: Computation is just another kind of pattern matching
 * where compute gadgets watch for requests and emit results.
 */

import { Graph } from "../src/minimal-graph.js";
import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeProgram } from "../src/pattern-words.js";

const graph = new Graph();
const context = createContext(graph);

console.log("=== Computation Through Patterns Demo ===\n");

// ============================================================================
// Part 1: Basic Arithmetic Through Patterns
// ============================================================================

console.log("--- Part 1: Arithmetic Patterns ---\n");

const arithmeticProgram = `
  ; Define some values
  fact [
    x value 10
    y value 20
    z value 5
  ]

  ; Request computations by creating compute edges
  fact [
    compute-1 op add
    compute-1 left x
    compute-1 right y

    compute-2 op multiply
    compute-2 left z
    compute-2 right 3
  ]

  ; Rule: Addition operator
  ; When we see a compute request with 'add' op, look up values and emit result
  rule add-compute [
    ?c op add |
    ?c left ?l |
    ?c right ?r |
    ?l value ?lv |
    ?r value ?rv
  ] -> [
    ?c pending true
  ]

  ; Rule: Multiplication operator
  rule mult-compute [
    ?c op multiply |
    ?c left ?l |
    ?c right ?r |
    ?l value ?lv |
    ?r value ?rv
  ] -> [
    ?c pending true
  ]

  ; Simulate compute gadgets that watch for pending computations
  ; In real system, these would be actual compute gadgets
  fact [
    compute-1 result 30
    compute-2 result 15
  ]

  ; Query computed results
  query [?c result ?r]
`;

let ast = parsePattern(arithmeticProgram);
let results = executeProgram(graph, ast, context);

console.log("Computed results:");
const computeResults = results[results.length - 1];
computeResults.forEach(binding => {
  console.log(`  ${binding.get("?C")} = ${binding.get("?R")}`);
});

// ============================================================================
// Part 2: Chained Computations
// ============================================================================

console.log("\n--- Part 2: Chained Computations ---\n");

const chainedProgram = `
  ; Clear previous state
  clear-graph

  ; Values and computation chain
  fact [
    a value 2
    b value 3
    c value 4
  ]

  ; Chain: (a + b) * c
  fact [
    step1 op add
    step1 left a
    step1 right b
    step1 output temp1

    step2 op multiply
    step2 left temp1
    step2 right c
    step2 output final
  ]

  ; Rule: Process computation chain
  rule chain-add [
    ?comp op add |
    ?comp left ?l |
    ?comp right ?r |
    ?comp output ?out |
    ?l value ?lv |
    ?r value ?rv
  ] -> [
    ?out value-pending 'computed
  ]

  ; Simulate computation results
  fact [
    temp1 value 5
    final value 20
  ]

  query [?x value ?v]
`;

ast = parsePattern(chainedProgram);
results = executeProgram(graph, ast, context);

console.log("Values after chained computation:");
const valueResults = results[results.length - 1];
valueResults.forEach(binding => {
  console.log(`  ${binding.get("?X")} = ${binding.get("?V")}`);
});

// ============================================================================
// Part 3: Aggregation Patterns
// ============================================================================

console.log("\n--- Part 3: Aggregation Patterns ---\n");

const aggregationProgram = `
  ; Clear and set up data
  clear-graph

  ; Items with prices
  fact [
    item1 price 10
    item1 category food

    item2 price 20
    item2 category food

    item3 price 15
    item3 category tools

    item4 price 25
    item4 category food
  ]

  ; Request aggregations
  fact [
    sum-food aggregate sum
    sum-food filter-by category
    sum-food filter-value food
    sum-food aggregate-attr price
  ]

  ; Rule: Identify items to aggregate
  rule mark-for-aggregation [
    ?agg aggregate ?op |
    ?agg filter-by ?attr |
    ?agg filter-value ?val |
    ?item ?attr ?val
  ] -> [
    ?agg includes ?item
  ]

  ; Rule: Mark aggregation as ready when items identified
  rule ready-to-compute [
    ?agg aggregate ?op |
    ?agg includes ?item
  ] -> [
    ?agg ready true
  ]

  ; Simulate aggregation result
  fact [sum-food result 55]

  ; Query aggregation
  query [sum-food includes ?item]
  query [sum-food result ?r]
`;

ast = parsePattern(aggregationProgram);
results = executeProgram(graph, ast, context);

console.log("Items included in sum-food aggregation:");
const includesResults = results[results.length - 2];
includesResults.forEach(binding => {
  console.log(`  - ${binding.get("?ITEM")}`);
});

console.log("\nAggregation result:");
const sumResults = results[results.length - 1];
sumResults.forEach(binding => {
  console.log(`  sum-food = ${binding.get("?R")}`);
});

// ============================================================================
// Part 4: Comparison and Filtering Without Expressions
// ============================================================================

console.log("\n--- Part 4: Comparisons Through Patterns ---\n");

const comparisonProgram = `
  ; Clear and set up
  clear-graph

  ; People with ages
  fact [
    alice age 30
    bob age 25
    charlie age 35
    diana age 28
  ]

  ; Define threshold
  fact [threshold min-age 28]

  ; Request comparisons
  fact [
    compare-alice person alice
    compare-alice against threshold
    compare-alice check greater-or-equal

    compare-bob person bob
    compare-bob against threshold
    compare-bob check greater-or-equal
  ]

  ; Rule: Mark comparison requests
  rule setup-comparison [
    ?comp person ?p |
    ?comp against ?t |
    ?p age ?age |
    ?t min-age ?min
  ] -> [
    ?comp person-age ?age |
    ?comp threshold-age ?min
  ]

  ; Simulate comparison results (would come from compute gadgets)
  fact [
    compare-alice result true
    compare-bob result false
  ]

  ; Rule: Filter based on comparison results
  rule mark-adults [
    ?comp person ?p |
    ?comp result true
  ] -> [
    ?p is-adult true
  ]

  query [?p is-adult true]
`;

ast = parsePattern(comparisonProgram);
results = executeProgram(graph, ast, context);

console.log("People meeting age threshold:");
const adultResults = results[results.length - 1];
adultResults.forEach(binding => {
  console.log(`  - ${binding.get("?P")}`);
});

// ============================================================================
// Part 5: Implicit Computation Through Pattern Semantics
// ============================================================================

console.log("\n--- Part 5: Implicit Computation ---\n");

const implicitProgram = `
  ; Clear and demonstrate implicit computation
  clear-graph

  ; Define relationships that imply computation
  fact [
    order-1 quantity 5
    order-1 unit-price 10
    order-1 needs total

    order-2 quantity 3
    order-2 unit-price 20
    order-2 needs total
  ]

  ; Rule: Pattern implies multiplication
  ; The pattern itself defines the computation semantics
  rule compute-total [
    ?order quantity ?q |
    ?order unit-price ?p |
    ?order needs total
  ] -> [
    ?order computing total
  ]

  ; Simulate computed totals
  fact [
    order-1 total 50
    order-2 total 60
  ]

  query [?order total ?t]
`;

ast = parsePattern(implicitProgram);
results = executeProgram(graph, ast, context);

console.log("Order totals (computed implicitly):");
const totalResults = results[results.length - 1];
totalResults.forEach(binding => {
  console.log(`  ${binding.get("?ORDER")} = ${binding.get("?T")}`);
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n=== Key Insights ===\n");
console.log("1. Computation is just pattern matching:");
console.log("   - Patterns identify computation requests");
console.log("   - Rules trigger on these patterns");
console.log("   - Compute gadgets (not shown) watch for requests and emit results\n");

console.log("2. No expression syntax needed:");
console.log("   - Everything stays as triples");
console.log("   - Computation semantics emerge from patterns");
console.log("   - The graph IS the computation\n");

console.log("3. Benefits of pure patterns:");
console.log("   - Uniformity: everything is pattern matching");
console.log("   - Extensibility: new computations are just new patterns");
console.log("   - Traceability: computation history is in the graph");
console.log("   - Parallelism: computations naturally parallel\n");

console.log("4. Connection to graph rewriting:");
console.log("   - Computations are graph transformations");
console.log("   - Results become new edges in the graph");
console.log("   - Everything remains monotonic\n");

// Cleanup
context.cleanup();
console.log("=== Demo Complete ===");